import sys
import asyncio

if sys.platform == "win32":
    asyncio.DefaultEventLoopPolicy = asyncio.WindowsSelectorEventLoopPolicy
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uuid
import time
from fastapi import FastAPI, Depends, status, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from contextlib import asynccontextmanager
from jose import jwt

from app.core.database import engine, get_db, SessionLocal
from app.core.config import settings
from fastapi.middleware.cors import CORSMiddleware
from app.core.logging import logger
from structlog.contextvars import bind_contextvars, clear_contextvars
from app.core.rate_limit import limiter
from slowapi.errors import RateLimitExceeded

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("DB engine ready")
    if "sqlite" in str(engine.url):
        try:
            from app.core.database import Base
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("SQLite tables initialized.")
        except Exception as e:
            logger.error("Failed to initialize SQLite tables", error=str(e))
    else:
        try:
            async with SessionLocal() as session:
                result = await session.execute(text("SELECT current_user;"))
                current_user = result.scalar()
                if current_user and ("postgres" in current_user.lower()):
                    logger.critical("Superuser DB connection detected. Refusing to start.")
                    sys.exit(1)
                else:
                    logger.info("Connected as DB user", current_user=current_user)
        except SystemExit:
            raise
        except Exception as e:
            logger.error("Failed to verify DB user", error=str(e))
    yield
    await engine.dispose()
    logger.info("DB engine disposed.")

from app.routers.auth import router as auth_router
from app.routers.items import router as items_router
from app.routers.profiles import router as profiles_router
from app.routers.products import router as products_router
from app.routers.browse import router as browse_router
from app.routers.uploads import router as uploads_router
from app.routers.wishlist import router as wishlist_router
from app.routers.reels import router as reels_router
from app.routers.users import router as users_router

app = FastAPI(
    title="Tohfa API",
    description="Backend API for Tohfa marketplace",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    retry_after = getattr(exc, "retry_after", 60)
    return JSONResponse(
        status_code=429,
        content={"detail": f"Too many requests, try again in {retry_after} seconds"},
        headers={"Retry-After": str(retry_after)}
    )

app.include_router(auth_router)
app.include_router(items_router)
app.include_router(profiles_router)
app.include_router(products_router)
app.include_router(browse_router)
app.include_router(uploads_router)
app.include_router(wishlist_router)
app.include_router(reels_router)
app.include_router(users_router)

@app.middleware("http")
async def structlog_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    user_id = None
    auth_header = request.headers.get("authorization")
    if auth_header:
        try:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                payload = jwt.decode(parts[1], settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
                user_id = payload.get("sub")
        except Exception:
            user_id = None
    ip = request.client.host if request.client else "unknown"
    bind_contextvars(request_id=request_id, user_id=user_id, path=request.url.path, method=request.method, ip=ip)
    start_time = time.perf_counter()
    try:
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        if response.status_code >= 400:
            logger.warn("Request error", status_code=response.status_code, duration_ms=duration_ms)
        else:
            logger.info("Request ok", status_code=response.status_code, duration_ms=duration_ms)
        response.headers["X-Request-Id"] = request_id
        return response
    except Exception as exc:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.error("Unhandled exception", exception_type=type(exc).__name__, exception_message=str(exc), duration_ms=duration_ms)
        raise exc
    finally:
        clear_contextvars()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_origin_regex=r"https?://.*" if (settings.ENVIRONMENT == "development" and "pytest" not in sys.modules) else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/v1/health")
async def api_health_check():
    return {"status": "ok"}

@app.get("/api/v1/health/db")
async def health_db_check(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(text("SELECT 1"))
        result.fetchone()
        return {"db": "ok"}
    except Exception as e:
        return JSONResponse(status_code=503, content={"db": "error", "detail": str(e)})

from fastapi import Body
from app.services.auth_service import login_user, signup_user, logout
from app.core.security import create_access_token, create_refresh_token
from app.models.refresh_token import RefreshToken
from app.models.profile import SellerProfile
from app.core.deps import get_current_user
from app.models.user import User
import hashlib, os

@app.post("/api/auth/login")
async def api_auth_login(request: Request, payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password:
        return JSONResponse(status_code=400, content={"error": True, "message": "Missing email or password"})
    try:
        from app.utils.request_meta import extract_request_meta
        ip_address, user_agent = extract_request_meta(request)
        user, access_token, raw_refresh = await login_user(db=db, email=email, password=password, user_agent=user_agent, ip_address=ip_address)
        return {"success": True, "data": {"access_token": access_token, "refresh_token": raw_refresh, "user": {"id": str(user.id), "email": user.email, "full_name": user.full_name, "role": user.role}}}
    except Exception as e:
        return JSONResponse(status_code=401, content={"error": True, "message": str(e), "code": "UNAUTHORIZED"})

@app.post("/api/auth/register/buyer", status_code=201)
async def api_auth_register_buyer(request: Request, payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    email, password, full_name = payload.get("email"), payload.get("password"), payload.get("full_name")
    if not email or not password:
        return JSONResponse(status_code=400, content={"error": True, "message": "Missing fields"})
    try:
        from app.utils.request_meta import extract_request_meta
        ip_address, user_agent = extract_request_meta(request)
        user = await signup_user(db=db, email=email, password=password, full_name=full_name, role="buyer", ip_address=ip_address, user_agent=user_agent)
        access_token = create_access_token(user.id, user.role)
        raw_refresh, expires_at = create_refresh_token(user.id)
        refresh_hash = hashlib.sha256(raw_refresh.encode()).hexdigest()
        db.add(RefreshToken(user_id=user.id, token_hash=refresh_hash, expires_at=expires_at, user_agent=user_agent, ip_address=ip_address))
        await db.flush()
        return {"success": True, "data": {"access_token": access_token, "refresh_token": raw_refresh, "user": {"id": str(user.id), "email": user.email, "full_name": user.full_name, "role": user.role}}}
    except Exception as e:
        return JSONResponse(status_code=409, content={"error": True, "message": str(e), "code": "EMAIL_EXISTS"})

@app.post("/api/auth/register/seller", status_code=201)
async def api_auth_register_seller(request: Request, payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    email, password, full_name = payload.get("email"), payload.get("password"), payload.get("full_name")
    if not email or not password:
        return JSONResponse(status_code=400, content={"error": True, "message": "Missing fields"})
    try:
        from app.utils.request_meta import extract_request_meta
        ip_address, user_agent = extract_request_meta(request)
        user = await signup_user(db=db, email=email, password=password, full_name=full_name, role="seller", ip_address=ip_address, user_agent=user_agent)
        db.add(SellerProfile(user_id=user.id, shop_name=f"{full_name}'s Shop" if full_name else "My Shop", shipping_days=3))
        access_token = create_access_token(user.id, user.role)
        raw_refresh, expires_at = create_refresh_token(user.id)
        refresh_hash = hashlib.sha256(raw_refresh.encode()).hexdigest()
        db.add(RefreshToken(user_id=user.id, token_hash=refresh_hash, expires_at=expires_at, user_agent=user_agent, ip_address=ip_address))
        await db.flush()
        return {"success": True, "data": {"access_token": access_token, "refresh_token": raw_refresh, "user": {"id": str(user.id), "email": user.email, "full_name": user.full_name, "role": user.role}}}
    except Exception as e:
        return JSONResponse(status_code=409, content={"error": True, "message": str(e), "code": "EMAIL_EXISTS"})

@app.post("/api/auth/logout")
async def api_auth_logout(request: Request, payload: dict = Body(...), db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    refresh_token = payload.get("refresh_token")
    if not refresh_token:
        return {"success": True}
    try:
        from app.utils.request_meta import extract_request_meta
        ip_address, user_agent = extract_request_meta(request)
        await logout(db=db, raw_refresh_token=refresh_token, ip_address=ip_address, user_agent=user_agent)
        return {"success": True}
    except Exception:
        return {"success": True}

@app.get("/api/profile/me")
async def api_profile_me(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    display_name = current_user.full_name or "Anonymous User"
    if current_user.role == "seller":
        from sqlalchemy import select
        result = await db.execute(select(SellerProfile).where(SellerProfile.user_id == current_user.id))
        sp = result.scalar_one_or_none()
        if sp and sp.shop_name:
            display_name = sp.shop_name
    return {"success": True, "data": {"id": str(current_user.id), "display_name": display_name, "email": current_user.email, "role": current_user.role, "avatar_url": None}}

os.makedirs("media/products", exist_ok=True)
os.makedirs("media/reels", exist_ok=True)
app.mount("/media", StaticFiles(directory="media"), name="media")
