import pytest
import uuid
from httpx import AsyncClient
from datetime import datetime, timedelta, timezone
from sqlalchemy.future import select

from app.models.user import User
from app.models.follow import Follow
from app.models.product import Product
from app.models.reel import Reel

@pytest.fixture
async def buyer_headers(buyer_token: str) -> dict:
    return {"Authorization": f"Bearer {buyer_token}"}

@pytest.fixture
async def seller_headers(seller_token: str) -> dict:
    return {"Authorization": f"Bearer {seller_token}"}

@pytest.fixture
async def seller_b_headers(client: AsyncClient, db) -> dict:
    from tests.conftest import create_user_token_helper
    token = await create_user_token_helper(client, "seller")
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
async def seller_a_headers(client: AsyncClient, db) -> dict:
    from tests.conftest import create_user_token_helper
    token = await create_user_token_helper(client, "seller")
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_follow_and_unfollow_user(client: AsyncClient, buyer_headers: dict, seller_headers: dict, db):
    # Get seller user to follow
    res = await client.get("/api/v1/auth/me", headers=seller_headers)
    seller_id = res.json()["id"]

    # 1. Follow User
    res = await client.post(f"/api/v1/users/{seller_id}/follow", headers=buyer_headers)
    assert res.status_code == 200
    assert res.json()["following"] is True

    # Check Follow table
    buyer_res = await client.get("/api/v1/auth/me", headers=buyer_headers)
    buyer_id = buyer_res.json()["id"]
    follow_res = await db.execute(select(Follow).where(Follow.follower_id == buyer_id, Follow.followed_id == seller_id))
    assert follow_res.scalar_one_or_none() is not None

    # 2. Unfollow User
    res = await client.delete(f"/api/v1/users/{seller_id}/follow", headers=buyer_headers)
    assert res.status_code == 200
    assert res.json()["following"] is False

    # Check Follow table
    follow_res = await db.execute(select(Follow).where(Follow.follower_id == buyer_id, Follow.followed_id == seller_id))
    assert follow_res.scalar_one_or_none() is None

@pytest.mark.asyncio
async def test_cannot_follow_self(client: AsyncClient, buyer_headers: dict):
    res = await client.get("/api/v1/auth/me", headers=buyer_headers)
    buyer_id = res.json()["id"]

    res = await client.post(f"/api/v1/users/{buyer_id}/follow", headers=buyer_headers)
    assert res.status_code == 400
    assert "cannot follow yourself" in res.json()["detail"]

@pytest.mark.asyncio
async def test_get_followers_and_following(client: AsyncClient, buyer_headers: dict, seller_headers: dict):
    # Get IDs
    seller_id = (await client.get("/api/v1/auth/me", headers=seller_headers)).json()["id"]
    buyer_id = (await client.get("/api/v1/auth/me", headers=buyer_headers)).json()["id"]

    # Buyer follows Seller
    await client.post(f"/api/v1/users/{seller_id}/follow", headers=buyer_headers)

    # Get Seller Followers
    res = await client.get(f"/api/v1/users/{seller_id}/followers")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert any(item["id"] == buyer_id for item in data["items"])
    assert "role" in data["items"][0]

    # Get Buyer Following
    res = await client.get(f"/api/v1/users/{buyer_id}/following")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert any(item["id"] == seller_id for item in data["items"])

@pytest.mark.asyncio
async def test_reels_feed_follows_priority(
    client: AsyncClient, 
    buyer_headers: dict, 
    seller_a_headers: dict,
    seller_b_headers: dict,
    db
):
    # Get identities
    buyer_id = (await client.get("/api/v1/auth/me", headers=buyer_headers)).json()["id"]
    seller_a_id = (await client.get("/api/v1/auth/me", headers=seller_a_headers)).json()["id"]
    seller_b_id = (await client.get("/api/v1/auth/me", headers=seller_b_headers)).json()["id"]
    
    # Create products for both
    from tests.test_reels import test_category
    cat = await test_category.__wrapped__(db)
    if not cat:
        # manual cat creation if fixture fails
        from app.models.category import Category
        cat = Category(slug="test-feed-cat", display_name="Test", icon_emoji="a")
        db.add(cat)
        await db.flush()

    prod_a = Product(seller_id=seller_a_id, category_id=cat.id, title="Prod A", description="A", price_paise=1, stock=1, is_active=True)
    prod_b = Product(seller_id=seller_b_id, category_id=cat.id, title="Prod B", description="B", price_paise=1, stock=1, is_active=True)
    db.add_all([prod_a, prod_b])
    await db.flush()

    # Create Reels
    # Reel A (Unfollowed) is newer
    now = datetime.now(timezone.utc)
    reel_a = Reel(
        seller_id=seller_a_id, product_id=prod_a.id, 
        video_url="/m/a.mp4", thumbnail_url="/m/a.jpg", duration_seconds=10, 
        is_active=True, created_at=now
    )
    # Reel B (Followed) is older
    reel_b = Reel(
        seller_id=seller_b_id, product_id=prod_b.id, 
        video_url="/m/b.mp4", thumbnail_url="/m/b.jpg", duration_seconds=10, 
        is_active=True, created_at=now - timedelta(days=1)
    )
    db.add_all([reel_a, reel_b])
    await db.flush()

    # Buyer follows Seller B
    await client.post(f"/api/v1/users/{seller_b_id}/follow", headers=buyer_headers)
    db.expire_all()

    # Fetch feed
    res = await client.get("/api/v1/reels/feed", headers=buyer_headers)
    assert res.status_code == 200
    items = res.json()["items"]
    
    # Since Seller B is followed, Reel B should appear before Reel A even though Reel A is newer!
    reel_b_idx = next(i for i, r in enumerate(items) if r["id"] == str(reel_b.id))
    reel_a_idx = next(i for i, r in enumerate(items) if r["id"] == str(reel_a.id))
    
    assert reel_b_idx < reel_a_idx, "Followed seller's older reel should appear before unfollowed seller's newer reel"
    
    # Now fetch feed anonymously, should be sorted purely chronologically (Reel A before Reel B)
    anon_res = await client.get("/api/v1/reels/feed")
    anon_items = anon_res.json()["items"]
    
    anon_reel_b_idx = next(i for i, r in enumerate(anon_items) if r["id"] == str(reel_b.id))
    anon_reel_a_idx = next(i for i, r in enumerate(anon_items) if r["id"] == str(reel_a.id))
    
    assert anon_reel_a_idx < anon_reel_b_idx, "Anonymous feed should be strictly chronological"
