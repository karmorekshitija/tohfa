import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.user import User
from app.models.profile import BuyerProfile, SellerProfile
from app.models.audit_log import AuditLog
from app.core.security import create_access_token

# Helpers to generate auth headers
def get_auth_headers(user_id: uuid.UUID, role: str) -> dict:
    token = create_access_token(user_id, role)
    return {"Authorization": f"Bearer {token}"}

async def create_user_direct(db: AsyncSession, email: str, role: str) -> User:
    user = User(
        email=email,
        password_hash="fake_hash",
        full_name="Test User",
        role=role,
        is_active=True
    )
    db.add(user)
    await db.flush()
    return user


# ==============================================================================
# ENDPOINT 1: GET /api/v1/profile/buyer (6 test cases)
# ==============================================================================

@pytest.mark.asyncio
async def test_get_buyer_profile_happy_default(client: AsyncClient, db: AsyncSession):
    # Case 1: Fresh buyer signs up (via DB helper), auto-profile created on GET (or signup)
    user = await create_user_direct(db, "buyer_get_1@example.com", "buyer")
    headers = get_auth_headers(user.id, "buyer")
    
    resp = await client.get("/api/v1/profile/buyer", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == str(user.id)
    assert data["default_address"] is None
    assert data["phone"] is None
    
    # Assert audit log
    audit_res = await db.execute(select(AuditLog).where(AuditLog.event_type == "profile.buyer.viewed"))
    logs = audit_res.scalars().all()
    assert len(logs) == 1
    assert logs[0].user_id == user.id

@pytest.mark.asyncio
async def test_get_buyer_profile_happy_existing(client: AsyncClient, db: AsyncSession):
    # Case 2: Existing profile in DB gets returned correctly without duplicates
    user = await create_user_direct(db, "buyer_get_2@example.com", "buyer")
    profile = BuyerProfile(user_id=user.id, default_address="123 Main St", phone="555-1234")
    db.add(profile)
    await db.flush()
    
    headers = get_auth_headers(user.id, "buyer")
    resp = await client.get("/api/v1/profile/buyer", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["default_address"] == "123 Main St"
    assert data["phone"] == "555-1234"

@pytest.mark.asyncio
async def test_get_buyer_profile_role_restriction_seller(client: AsyncClient, db: AsyncSession):
    # Case 3: Sellers cannot access buyer GET endpoint (403)
    user = await create_user_direct(db, "buyer_get_3@example.com", "seller")
    headers = get_auth_headers(user.id, "seller")
    
    resp = await client.get("/api/v1/profile/buyer", headers=headers)
    assert resp.status_code == 403
    assert "Only users with the buyer role" in resp.json()["detail"]

@pytest.mark.asyncio
async def test_get_buyer_profile_unauthorized(client: AsyncClient):
    # Case 4: Anonymous user receives 401
    resp = await client.get("/api/v1/profile/buyer")
    assert resp.status_code == 401

@pytest.mark.asyncio
async def test_get_buyer_profile_cascade_delete(client: AsyncClient, db: AsyncSession):
    # Case 5: Deleting the User deletes the BuyerProfile cascadedly
    user = await create_user_direct(db, "buyer_get_5@example.com", "buyer")
    profile = BuyerProfile(user_id=user.id, default_address="123 Main St")
    db.add(profile)
    await db.flush()
    
    # Assert profile exists
    res1 = await db.execute(select(BuyerProfile).where(BuyerProfile.user_id == user.id))
    assert res1.scalar_one_or_none() is not None
    
    # Delete User
    await db.delete(user)
    await db.flush()
    
    # Assert profile is cascade-deleted
    db.expire_all()
    res2 = await db.execute(select(BuyerProfile).where(BuyerProfile.user_id == user.id))
    assert res2.scalar_one_or_none() is None

@pytest.mark.asyncio
async def test_get_buyer_profile_multiple_views_audit(client: AsyncClient, db: AsyncSession):
    # Case 6: Multiple view requests log multiple view audit events
    user = await create_user_direct(db, "buyer_get_6@example.com", "buyer")
    headers = get_auth_headers(user.id, "buyer")
    
    await client.get("/api/v1/profile/buyer", headers=headers)
    await client.get("/api/v1/profile/buyer", headers=headers)
    
    audit_res = await db.execute(
        select(AuditLog)
        .where(AuditLog.event_type == "profile.buyer.viewed")
        .where(AuditLog.user_id == user.id)
    )
    logs = audit_res.scalars().all()
    assert len(logs) == 2


# ==============================================================================
# ENDPOINT 2: PATCH /api/v1/profile/buyer (6 test cases)
# ==============================================================================

@pytest.mark.asyncio
async def test_patch_buyer_profile_happy_update_all(client: AsyncClient, db: AsyncSession):
    # Case 1: Update all fields successfully
    user = await create_user_direct(db, "buyer_patch_1@example.com", "buyer")
    profile = BuyerProfile(user_id=user.id)
    db.add(profile)
    await db.flush()
    
    headers = get_auth_headers(user.id, "buyer")
    payload = {"default_address": "456 Oak Rd", "phone": "1-800-555-0199"}
    
    resp = await client.patch("/api/v1/profile/buyer", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["default_address"] == "456 Oak Rd"
    assert data["phone"] == "1-800-555-0199"
    
    # Verify DB state
    res = await db.execute(select(BuyerProfile).where(BuyerProfile.user_id == user.id))
    db_profile = res.scalar_one()
    assert db_profile.default_address == "456 Oak Rd"

    
    # Audit log
    audit_res = await db.execute(select(AuditLog).where(AuditLog.event_type == "profile.buyer.updated"))
    logs = audit_res.scalars().all()
    assert len(logs) == 1

@pytest.mark.asyncio
async def test_patch_buyer_profile_partial(client: AsyncClient, db: AsyncSession):
    # Case 2: Partial update leaving other fields unmodified
    user = await create_user_direct(db, "buyer_patch_2@example.com", "buyer")
    profile = BuyerProfile(user_id=user.id, default_address="Original Address", phone="Original Phone")
    db.add(profile)
    await db.flush()
    
    headers = get_auth_headers(user.id, "buyer")
    payload = {"phone": "New Phone"}
    
    resp = await client.patch("/api/v1/profile/buyer", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["default_address"] == "Original Address"
    assert data["phone"] == "New Phone"

@pytest.mark.asyncio
async def test_patch_buyer_profile_role_restriction_seller(client: AsyncClient, db: AsyncSession):
    # Case 3: Sellers cannot update buyer profiles (403)
    user = await create_user_direct(db, "buyer_patch_3@example.com", "seller")
    headers = get_auth_headers(user.id, "seller")
    
    resp = await client.patch("/api/v1/profile/buyer", json={"phone": "123"}, headers=headers)
    assert resp.status_code == 403

@pytest.mark.asyncio
async def test_patch_buyer_profile_unauthorized(client: AsyncClient):
    # Case 4: Anonymous PATCH gets 401
    resp = await client.patch("/api/v1/profile/buyer", json={"phone": "123"})
    assert resp.status_code == 401

@pytest.mark.asyncio
async def test_patch_buyer_profile_noop(client: AsyncClient, db: AsyncSession):
    # Case 5: Empty payload patch leaves everything as is
    user = await create_user_direct(db, "buyer_patch_5@example.com", "buyer")
    profile = BuyerProfile(user_id=user.id, default_address="Same", phone="Same")
    db.add(profile)
    await db.flush()
    
    headers = get_auth_headers(user.id, "buyer")
    resp = await client.patch("/api/v1/profile/buyer", json={}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["default_address"] == "Same"
    assert data["phone"] == "Same"

@pytest.mark.asyncio
async def test_patch_buyer_profile_fallback_creation(client: AsyncClient, db: AsyncSession):
    # Case 6: Fallback auto-create on PATCH if row was deleted but User is active
    user = await create_user_direct(db, "buyer_patch_6@example.com", "buyer")
    # Ensure profile row does not exist in DB
    
    headers = get_auth_headers(user.id, "buyer")
    payload = {"default_address": "Created On Patch"}
    
    resp = await client.patch("/api/v1/profile/buyer", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["default_address"] == "Created On Patch"


# ==============================================================================
# ENDPOINT 3: GET /api/v1/profile/seller (6 test cases)
# ==============================================================================

@pytest.mark.asyncio
async def test_get_seller_profile_happy_default(client: AsyncClient, db: AsyncSession):
    # Case 1: Fresh seller GET auto-creates seller profile with default 5 shipping days
    user = await create_user_direct(db, "seller_get_1@example.com", "seller")
    headers = get_auth_headers(user.id, "seller")
    
    resp = await client.get("/api/v1/profile/seller", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == str(user.id)
    assert data["shipping_days"] == 5
    assert data["shop_name"] is None
    
    # Assert audit log
    audit_res = await db.execute(select(AuditLog).where(AuditLog.event_type == "profile.seller.viewed"))
    logs = audit_res.scalars().all()
    assert len(logs) == 1

@pytest.mark.asyncio
async def test_get_seller_profile_happy_existing(client: AsyncClient, db: AsyncSession):
    # Case 2: Existing seller profile retrieved cleanly
    user = await create_user_direct(db, "seller_get_2@example.com", "seller")
    profile = SellerProfile(
        user_id=user.id,
        shop_name="Handmade Joy",
        bio="Making happy things.",
        shipping_days=3,
        instagram_handle="handmade_joy"
    )
    db.add(profile)
    await db.flush()
    
    headers = get_auth_headers(user.id, "seller")
    resp = await client.get("/api/v1/profile/seller", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["shop_name"] == "Handmade Joy"
    assert data["shipping_days"] == 3
    assert data["instagram_handle"] == "handmade_joy"

@pytest.mark.asyncio
async def test_get_seller_profile_role_restriction_buyer(client: AsyncClient, db: AsyncSession):
    # Case 3: Buyers cannot access seller GET endpoint (403)
    user = await create_user_direct(db, "seller_get_3@example.com", "buyer")
    headers = get_auth_headers(user.id, "buyer")
    
    resp = await client.get("/api/v1/profile/seller", headers=headers)
    assert resp.status_code == 403

@pytest.mark.asyncio
async def test_get_seller_profile_unauthorized(client: AsyncClient):
    # Case 4: Anonymous user receives 401
    resp = await client.get("/api/v1/profile/seller")
    assert resp.status_code == 401

@pytest.mark.asyncio
async def test_get_seller_profile_cascade_delete(client: AsyncClient, db: AsyncSession):
    # Case 5: Deleting the User deletes the SellerProfile cascadedly
    user = await create_user_direct(db, "seller_get_5@example.com", "seller")
    profile = SellerProfile(user_id=user.id, shop_name="My Shop")
    db.add(profile)
    await db.flush()
    
    await db.delete(user)
    await db.flush()
    
    db.expire_all()
    res = await db.execute(select(SellerProfile).where(SellerProfile.user_id == user.id))
    assert res.scalar_one_or_none() is None

@pytest.mark.asyncio
async def test_get_seller_profile_multiple_views_audit(client: AsyncClient, db: AsyncSession):
    # Case 6: Multiple view logs
    user = await create_user_direct(db, "seller_get_6@example.com", "seller")
    headers = get_auth_headers(user.id, "seller")
    
    await client.get("/api/v1/profile/seller", headers=headers)
    await client.get("/api/v1/profile/seller", headers=headers)
    
    audit_res = await db.execute(
        select(AuditLog)
        .where(AuditLog.event_type == "profile.seller.viewed")
        .where(AuditLog.user_id == user.id)
    )
    logs = audit_res.scalars().all()
    assert len(logs) == 2


# ==============================================================================
# ENDPOINT 4: PATCH /api/v1/profile/seller (6 test cases)
# ==============================================================================

@pytest.mark.asyncio
async def test_patch_seller_profile_happy_update_all(client: AsyncClient, db: AsyncSession):
    # Case 1: Update all seller fields successfully
    user = await create_user_direct(db, "seller_patch_1@example.com", "seller")
    profile = SellerProfile(user_id=user.id)
    db.add(profile)
    await db.flush()
    
    headers = get_auth_headers(user.id, "seller")
    payload = {
        "shop_name": "Woodcrafts Unlimited",
        "bio": "Expert woodworking from the heart.",
        "shipping_days": 4,
        "instagram_handle": "woodcrafts_unltd",
        "payout_method": "stripe_connect"
    }
    
    resp = await client.patch("/api/v1/profile/seller", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["shop_name"] == "Woodcrafts Unlimited"
    assert data["bio"] == "Expert woodworking from the heart."
    assert data["shipping_days"] == 4
    assert data["instagram_handle"] == "woodcrafts_unltd"
    assert data["payout_method"] == "stripe_connect"
    
    # Audit log
    audit_res = await db.execute(select(AuditLog).where(AuditLog.event_type == "profile.seller.updated"))
    logs = audit_res.scalars().all()
    assert len(logs) == 1

@pytest.mark.asyncio
async def test_patch_seller_profile_partial(client: AsyncClient, db: AsyncSession):
    # Case 2: Partial updates maintain other existing fields
    user = await create_user_direct(db, "seller_patch_2@example.com", "seller")
    profile = SellerProfile(
        user_id=user.id,
        shop_name="Original Shop",
        shipping_days=7
    )
    db.add(profile)
    await db.flush()
    
    headers = get_auth_headers(user.id, "seller")
    payload = {"shipping_days": 2}
    
    resp = await client.patch("/api/v1/profile/seller", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["shop_name"] == "Original Shop"
    assert data["shipping_days"] == 2

@pytest.mark.asyncio
async def test_patch_seller_profile_role_restriction_buyer(client: AsyncClient, db: AsyncSession):
    # Case 3: Buyers cannot update seller profiles (403)
    user = await create_user_direct(db, "seller_patch_3@example.com", "buyer")
    headers = get_auth_headers(user.id, "buyer")
    
    resp = await client.patch("/api/v1/profile/seller", json={"shipping_days": 3}, headers=headers)
    assert resp.status_code == 403

@pytest.mark.asyncio
async def test_patch_seller_profile_unauthorized(client: AsyncClient):
    # Case 4: Anonymous PATCH gets 401
    resp = await client.patch("/api/v1/profile/seller", json={"shipping_days": 3})
    assert resp.status_code == 401

@pytest.mark.asyncio
async def test_patch_seller_profile_validation_len_limits(client: AsyncClient, db: AsyncSession):
    # Case 5: Over length bounds on shop_name (80), bio (500), instagram_handle (30) returns 422
    user = await create_user_direct(db, "seller_patch_5@example.com", "seller")
    profile = SellerProfile(user_id=user.id)
    db.add(profile)
    await db.flush()
    
    headers = get_auth_headers(user.id, "seller")
    
    # Too long shop name (> 80 chars)
    payload_shop = {"shop_name": "x" * 81}
    resp1 = await client.patch("/api/v1/profile/seller", json=payload_shop, headers=headers)
    assert resp1.status_code == 422
    
    # Too long bio (> 500 chars)
    payload_bio = {"bio": "y" * 501}
    resp2 = await client.patch("/api/v1/profile/seller", json=payload_bio, headers=headers)
    assert resp2.status_code == 422
    
    # Too long instagram handle (> 30 chars)
    payload_insta = {"instagram_handle": "z" * 31}
    resp3 = await client.patch("/api/v1/profile/seller", json=payload_insta, headers=headers)
    assert resp3.status_code == 422

@pytest.mark.asyncio
async def test_patch_seller_profile_validation_shipping_days(client: AsyncClient, db: AsyncSession):
    # Case 6: shipping_days < 1 returns 422 Unprocessable Entity
    user = await create_user_direct(db, "seller_patch_6@example.com", "seller")
    profile = SellerProfile(user_id=user.id)
    db.add(profile)
    await db.flush()
    
    headers = get_auth_headers(user.id, "seller")
    
    payload = {"shipping_days": 0}
    resp = await client.patch("/api/v1/profile/seller", json=payload, headers=headers)
    assert resp.status_code == 422
