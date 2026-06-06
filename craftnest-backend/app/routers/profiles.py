from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.profile import BuyerProfile, SellerProfile
from app.schemas.profile import (
    BuyerProfileResponse,
    BuyerProfileUpdate,
    SellerProfileResponse,
    SellerProfileUpdate,
)
from app.services.audit_service import log_event
from app.utils.request_meta import extract_request_meta
from app.core.rate_limit import rate_limit_by_user

router = APIRouter(prefix="/api/v1/profile", tags=["Profiles"])

@router.get("/buyer", response_model=BuyerProfileResponse)
@rate_limit_by_user("120/minute")
async def get_buyer_profile(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves the logged-in buyer's profile (automatically creating it with defaults if missing)."""
    if current_user.role != "buyer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only users with the buyer role can access this resource."
        )

    # Find profile
    result = await db.execute(
        select(BuyerProfile).where(BuyerProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        # Auto-create if it does not exist
        profile = BuyerProfile(user_id=current_user.id)
        db.add(profile)
        await db.flush()

    # Log audit event
    ip_address, user_agent = extract_request_meta(request)
    await log_event(
        db=db,
        event_type="profile.buyer.viewed",
        user_id=current_user.id,
        ip_address=ip_address,
        user_agent=user_agent
    )
    await db.flush()
    await db.refresh(profile)

    return profile


@router.patch("/buyer", response_model=BuyerProfileResponse)
@rate_limit_by_user("120/minute")
async def update_buyer_profile(
    request: Request,
    profile_in: BuyerProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates the logged-in buyer's profile using PATCH semantics."""
    if current_user.role != "buyer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only users with the buyer role can access this resource."
        )

    result = await db.execute(
        select(BuyerProfile).where(BuyerProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        # Fallback auto-create on patch too
        profile = BuyerProfile(user_id=current_user.id)
        db.add(profile)
        await db.flush()

    # Apply updates using PATCH semantics (only update provided fields)
    update_data = profile_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.flush()

    # Log audit event
    ip_address, user_agent = extract_request_meta(request)
    await log_event(
        db=db,
        event_type="profile.buyer.updated",
        user_id=current_user.id,
        ip_address=ip_address,
        user_agent=user_agent,
        details={"updated_fields": list(update_data.keys())}
    )
    await db.flush()
    await db.refresh(profile)

    return profile


@router.get("/seller", response_model=SellerProfileResponse)
@rate_limit_by_user("120/minute")
async def get_seller_profile(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves the logged-in seller's profile (automatically creating it with defaults if missing)."""
    if current_user.role != "seller":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only users with the seller role can access this resource."
        )

    result = await db.execute(
        select(SellerProfile).where(SellerProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        # Auto-create if it does not exist
        profile = SellerProfile(user_id=current_user.id)
        db.add(profile)
        await db.flush()

    # Log audit event
    ip_address, user_agent = extract_request_meta(request)
    await log_event(
        db=db,
        event_type="profile.seller.viewed",
        user_id=current_user.id,
        ip_address=ip_address,
        user_agent=user_agent
    )
    await db.flush()
    await db.refresh(profile)

    return profile


@router.patch("/seller", response_model=SellerProfileResponse)
@rate_limit_by_user("120/minute")
async def update_seller_profile(
    request: Request,
    profile_in: SellerProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates the logged-in seller's profile using PATCH semantics."""
    if current_user.role != "seller":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only users with the seller role can access this resource."
        )

    result = await db.execute(
        select(SellerProfile).where(SellerProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        # Fallback auto-create on patch too
        profile = SellerProfile(user_id=current_user.id)
        db.add(profile)
        await db.flush()

    # Apply updates using PATCH semantics
    update_data = profile_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.flush()

    # Log audit event
    ip_address, user_agent = extract_request_meta(request)
    await log_event(
        db=db,
        event_type="profile.seller.updated",
        user_id=current_user.id,
        ip_address=ip_address,
        user_agent=user_agent,
        details={"updated_fields": list(update_data.keys())}
    )
    await db.flush()
    await db.refresh(profile)

    return profile

