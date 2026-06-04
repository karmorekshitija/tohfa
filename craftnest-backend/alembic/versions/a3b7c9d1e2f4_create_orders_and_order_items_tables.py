"""create_orders_and_order_items_tables

Revision ID: a3b7c9d1e2f4
Revises: 69a2f1e21e1e
Create Date: 2026-05-21 22:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import app


# revision identifiers, used by Alembic.
revision: str = 'a3b7c9d1e2f4'
down_revision: Union[str, Sequence[str], None] = ('69a2f1e21e1e', '6f54c13a078d')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create orders and order_items tables."""

    # ── orders ───────────────────────────────────────────────────────
    op.create_table(
        'orders',
        sa.Column('id', app.core.database.GUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('buyer_id', app.core.database.GUID(), nullable=False),
        sa.Column('status', sa.Text(), server_default=sa.text("'pending'"), nullable=False),
        sa.Column('total_paise', sa.Integer(), nullable=False),
        sa.Column('shipping_address', sa.Text(), nullable=False),
        sa.Column('seller_note', sa.Text(), nullable=True),
        sa.Column('tracking_code', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            "status IN ('pending','awaiting_payment','paid_offline',"
            "'processing','shipped','delivered','cancelled','refunded')",
            name='check_order_status',
        ),
        sa.ForeignKeyConstraint(['buyer_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_orders_buyer_id'), 'orders', ['buyer_id'], unique=False)

    # ── order_items ──────────────────────────────────────────────────
    op.create_table(
        'order_items',
        sa.Column('id', app.core.database.GUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('order_id', app.core.database.GUID(), nullable=False),
        sa.Column('product_id', app.core.database.GUID(), nullable=False),
        sa.Column('seller_id', app.core.database.GUID(), nullable=False),
        sa.Column('title_snapshot', sa.Text(), nullable=False),
        sa.Column('price_snapshot_paise', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('quantity >= 1', name='check_order_item_qty'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['seller_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_order_items_order_id'), 'order_items', ['order_id'], unique=False)
    op.create_index(op.f('ix_order_items_product_id'), 'order_items', ['product_id'], unique=False)
    op.create_index(op.f('ix_order_items_seller_id'), 'order_items', ['seller_id'], unique=False)


def downgrade() -> None:
    """Drop order_items then orders."""
    op.drop_index(op.f('ix_order_items_seller_id'), table_name='order_items')
    op.drop_index(op.f('ix_order_items_product_id'), table_name='order_items')
    op.drop_index(op.f('ix_order_items_order_id'), table_name='order_items')
    op.drop_table('order_items')
    op.drop_index(op.f('ix_orders_buyer_id'), table_name='orders')
    op.drop_table('orders')
