import uuid
from datetime import datetime
from pydantic import BaseModel, Field

class BuyerProfileResponse(BaseModel):
    user_id: uuid.UUID
    default_address: str | None = None
    phone: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BuyerProfileUpdate(BaseModel):
    default_address: str | None = None
    phone: str | None = None


class SellerProfileResponse(BaseModel):
    user_id: uuid.UUID
    shop_name: str | None = None
    bio: str | None = None
    shipping_days: int
    instagram_handle: str | None = None
    payout_method: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SellerProfileUpdate(BaseModel):
    shop_name: str | None = Field(default=None, max_length=80)
    bio: str | None = Field(default=None, max_length=500)
    shipping_days: int | None = Field(default=None, ge=1)
    instagram_handle: str | None = Field(default=None, max_length=30)
    payout_method: str | None = None
