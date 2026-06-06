import uuid
from datetime import datetime
from pydantic import BaseModel, Field

class ReelRead(BaseModel):
    id: uuid.UUID
    seller_id: uuid.UUID
    product_id: uuid.UUID
    video_url: str
    thumbnail_url: str
    duration_seconds: int
    caption: str | None = None
    view_count: int
    like_count: int
    comment_count: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ProductSummary(BaseModel):
    id: uuid.UUID
    title: str
    price_paise: int
    image_urls: list[str]
    is_active: bool

    class Config:
        from_attributes = True

class SellerSummary(BaseModel):
    shop_name: str | None = None
    user_id: uuid.UUID

    class Config:
        from_attributes = True

class ReelFeedItem(BaseModel):
    id: uuid.UUID
    video_url: str
    thumbnail_url: str
    caption: str | None = None
    duration_seconds: int
    like_count: int
    comment_count: int
    has_liked: bool = False
    product: ProductSummary
    seller: SellerSummary
    created_at: datetime

    class Config:
        from_attributes = True

class ReelFeedResponse(BaseModel):
    items: list[ReelFeedItem]
    next_cursor: str | None = None


class ReelCommentCreate(BaseModel):
    comment: str = Field(..., max_length=300)


class ReelCommentRead(BaseModel):
    id: uuid.UUID
    reel_id: uuid.UUID
    author_id: uuid.UUID
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReelCommentsResponse(BaseModel):
    items: list[ReelCommentRead]
    total: int
    limit: int
    offset: int

