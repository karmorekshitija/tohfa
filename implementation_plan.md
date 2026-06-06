# Tohfa — Final Implementation Plan
## Hand This to Your Co-founder (or Execute on Any Device)

---

## ✅ What Is Already Done (On This Machine)

These steps are **already complete** — do NOT redo them:

| # | Done | What Happened |
|---|---|---|
| 1 | ✅ | `git stash → git pull → git stash pop` — synced with GitHub |
| 2 | ✅ | Git conflict resolved — deleted `craftnest-backend/main.py` and `craftnest-backend/run.py` from local |
| 3 | ✅ | **Old frontend DELETED** — all 17 old files wiped from `craftnest-backend/frontend/` |
| 4 | ✅ | New frontend already pulled — `tohfa/frontend/` now has `buyer/`, `seller/`, `admin/`, `auth/` |
| 5 | ✅ | Git committed locally |

---

## 🔍 Current State of the Project

```
tohfa/
├── frontend/                   ← ✅ NEW FRONTEND (pulled from GitHub)
│   ├── buyer/                  ← 22 HTML files, wired to backend API
│   ├── seller/                 ← 10 HTML files, wired to backend API
│   ├── admin/                  ← 9 HTML files
│   ├── auth/                   ← 5 HTML files
│   ├── src/utils/              ← apiClient.js, auth.js, currency.js
│   ├── package.json            ← uses Vite + Axios
│   └── vite.config.js          ← proxies /api → localhost:5000
│
├── craftnest-backend/          ← Python FastAPI backend
│   ├── app/                    ← All routers, models, services INTACT ✅
│   ✗ main.py                   ← MISSING — needs to be recreated (Step 1)
│   ✗ run.py                    ← MISSING — needs to be recreated (Step 2)
│
├── stitch_screens/             ← 30 extra Stitch screens (some not in frontend yet)
└── botanical_seller_studio/    ← 16 Seller Studio screens (some not in frontend yet)
```

---

## 🔧 Step-by-Step Execution

### STEP 1 — Recreate `craftnest-backend/main.py`

Create `/Users/krinjal_agrawal/tohfa/craftnest-backend/main.py`:

```python
import sys
import asyncio

if sys.platform == "win32":
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
```

---

## STEP 2 — Recreate `craftnest-backend/run.py`

```python
import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn
from app.main import app

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5002, log_level="info")
```

---

## STEP 3 — Update `frontend/vite.config.js`

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        secure: false
      },
      '/media': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
```

---

## STEP 4 — Install Frontend npm Packages

```bash
cd /Users/krinjal_agrawal/tohfa/frontend
npm install
```

---

## STEP 5 — Add Remaining Stitch Screens

Run from `/Users/krinjal_agrawal/tohfa/`:

```bash
# Buyer extras
cp stitch_screens/01_tohfa_saved_makes_-_re-learn_edition_code.html frontend/buyer/saved-makes.html
cp stitch_screens/24_tohfa_payment_handoff_-_centered_nav_edition_code.html frontend/buyer/payment-handoff.html
cp stitch_screens/25_tohfa_cancel_order_confirmation_-_desktop_code.html frontend/buyer/cancel-order.html

# Seller Studio extras
cp botanical_seller_studio/13_tofa_seller_studio_-_create_listing_full_wizard_code.html frontend/seller/create-listing.html
cp botanical_seller_studio/15_tofa_seller_studio_-_photos_step_1_full_page_match_code.html frontend/seller/listing-photos.html
cp botanical_seller_studio/16_tofa_seller_studio_-_listing_details_step_2_header_match_code.html frontend/seller/listing-details.html
cp botanical_seller_studio/01_tofa_seller_studio_-_pricing__stock_step_3_unified_layout_code.html frontend/seller/listing-pricing-a.html
cp botanical_seller_studio/06_tofa_seller_studio_-_pricing__stock_refined_sidebar_card_code.html frontend/seller/listing-pricing-b.html
cp botanical_seller_studio/08_tofa_seller_studio_-_shipping_step_4_header_match_code.html frontend/seller/listing-shipping.html
cp botanical_seller_studio/12_tofa_seller_studio_-_preview_step_5_modal_style_code.html frontend/seller/listing-preview.html
cp botanical_seller_studio/05_tofa_-_become_a_seller_landing_page_code.html frontend/seller/become-seller.html
cp botanical_seller_studio/07_tofa_seller_studio_-_analytics_enhanced_style_code.html frontend/seller/analytics.html
cp botanical_seller_studio/10_tofa_seller_studio_-_reviews_aligned_sidebar_code.html frontend/seller/reviews.html
cp botanical_seller_studio/11_tofa_seller_studio_-_profile__settings_code.html frontend/seller/profile-settings.html
cp botanical_seller_studio/04_tofa_seller_studio_-_store_config_code.html frontend/seller/store-config.html
cp stitch_screens/03_tohfa_payment_history_-_artisan_studio_desktop_code.html frontend/seller/payment-history.html
cp stitch_screens/29_tohfa_reel_upload_-_studio_desktop_code.html frontend/seller/reel-upload.html
cp stitch_screens/18_tohfa_reel_upload_-_success_state_code.html frontend/seller/reel-upload-success.html

# Auth extras
cp auth_screens/05_tohfa_session_ended_-_desktop_code.html frontend/auth/session-ended.html
cp auth_screens/06_tohfa_profile__logout_confirmation_-_desktop_code.html frontend/auth/logout-confirmation.html
```

---

## STEP 6 — Commit and Push

```bash
cd /Users/krinjal_agrawal/tohfa
git add craftnest-backend/main.py craftnest-backend/run.py frontend/
git commit -m "feat: restore backend + add remaining Stitch screens + fix Vite proxy to port 5002"
git push
```

---

## STEP 7 — HOW TO RUN THE APP

**Terminal 1 — Python Backend (port 5002):**
```bash
cd /Users/krinjal_agrawal/tohfa/craftnest-backend
source .venv/bin/activate
python run.py
```

**Terminal 2 — Frontend (Vite dev server):**
```bash
cd /Users/krinjal_agrawal/tohfa/frontend
npm run dev
```

**Open browser at:** `http://localhost:5173`

> [!IMPORTANT]
> Both terminals must be running. Vite proxies `/api` calls to the Python backend on port 5002.

---

## Final URL Map

| URL | Page |
|---|---|
| `http://localhost:5173/` | → redirects to Login |
| `http://localhost:5173/auth/login.html` | Login |
| `http://localhost:5173/buyer/home.html` | Buyer Home Feed |
| `http://localhost:5173/seller/dashboard.html` | Seller Studio |
| `http://localhost:5173/admin/orders.html` | Admin Panel |
