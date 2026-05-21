import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.follow import Follow
from app.schemas.user import FollowListResponse
from app.services.audit_service import log_event
from app.utils.request_meta import extract_request_meta

router = APIRouter(prefix="/api/v1/users", tags=["Users"])

@router.post("/{id}/follow", status_code=status.HTTP_200_OK)
async def follow_user(
    id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.id == id:
        raise HTTPException(status_code=400, detail="You cannot follow yourself")
        
    # Check if target user exists
    target = await db.get(User, id)
    if not target or not target.is_active:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check if already following
    res = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.followed_id == id
        )
    )
    existing = res.scalar_one_or_none()
    
    if not existing:
        follow_record = Follow(follower_id=current_user.id, followed_id=id)
        db.add(follow_record)
        
        # Audit Log
        ip, ua = extract_request_meta(request)
        await log_event(
            db=db,
            event_type="user.follow",
            user_id=current_user.id,
            ip_address=ip,
            user_agent=ua,
            details={"followed_user_id": str(id)}
        )
        await db.commit()
        
    return {"detail": "User followed successfully", "following": True}


@router.delete("/{id}/follow", status_code=status.HTTP_200_OK)
async def unfollow_user(
    id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    res = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.followed_id == id
        )
    )
    existing = res.scalar_one_or_none()
    
    if existing:
        await db.delete(existing)
        
        # Audit Log
        ip, ua = extract_request_meta(request)
        await log_event(
            db=db,
            event_type="user.unfollow",
            user_id=current_user.id,
            ip_address=ip,
            user_agent=ua,
            details={"unfollowed_user_id": str(id)}
        )
        await db.commit()
        
    return {"detail": "User unfollowed successfully", "following": False}


@router.get("/{id}/followers", response_model=FollowListResponse)
async def get_followers(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    # Verify user exists
    target = await db.get(User, id)
    if not target or not target.is_active:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Get total count
    count_res = await db.execute(
        select(func.count(Follow.follower_id)).where(Follow.followed_id == id)
    )
    total = count_res.scalar() or 0
    
    # Get items
    query = (
        select(User)
        .join(Follow, Follow.follower_id == User.id)
        .where(Follow.followed_id == id)
        .order_by(Follow.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(query)
    users = res.scalars().all()
    
    return {
        "items": users,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/{id}/following", response_model=FollowListResponse)
async def get_following(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    # Verify user exists
    target = await db.get(User, id)
    if not target or not target.is_active:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Get total count
    count_res = await db.execute(
        select(func.count(Follow.followed_id)).where(Follow.follower_id == id)
    )
    total = count_res.scalar() or 0
    
    # Get items
    query = (
        select(User)
        .join(Follow, Follow.followed_id == User.id)
        .where(Follow.follower_id == id)
        .order_by(Follow.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(query)
    users = res.scalars().all()
    
    return {
        "items": users,
        "total": total,
        "limit": limit,
        "offset": offset
    }
