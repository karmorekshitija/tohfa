"""
Order & OrderItem models for CraftNest.

── State Machine ──────────────────────────────────────────────────────
  pending → awaiting_payment → paid_offline → processing → shipped → delivered
                             ↘ cancelled   (buyer cancels before processing)
  processing → cancelled                   (admin/seller cancels with reason)
  delivered  → refunded                    (Week 8, via Razorpay)
───────────────────────────────────────────────────────────────────────

Design notes:
  • total_paise is set on creation from line items; never recalculated
    (product prices can change after the order is placed).
  • shipping_address is a snapshot string copied from buyer_profile at
    order time — not a FK to an address table.
  • order_items are immutable after creation.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    String, Integer, Text, DateTime, ForeignKey, CheckConstraint, text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base, GUID


# ── Valid statuses (also enforced at DB level via CHECK) ──────────────
ORDER_STATUSES = (
    "pending",
    "awaiting_payment",
    "paid_offline",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
)


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','awaiting_payment','paid_offline',"
            "'processing','shipped','delivered','cancelled','refunded')",
            name="check_order_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        Text,
        default="pending",
        server_default=text("'pending'"),
        nullable=False,
    )
    total_paise: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    shipping_address: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    seller_note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    tracking_code: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    buyer = relationship("User")
    items = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("quantity >= 1", name="check_order_item_qty"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("orders.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("products.id"),
        index=True,
        nullable=False,
    )
    seller_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("users.id"),
        index=True,
        nullable=False,
    )
    title_snapshot: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    price_snapshot_paise: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(
        Integer,
        default=1,
        server_default=text("1"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    order = relationship("Order", back_populates="items")
    product = relationship("Product")
    seller = relationship("User")
