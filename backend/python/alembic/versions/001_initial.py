"""Initial schema and seed plans

Revision ID: 001_initial
Revises:
Create Date: 2026-03-27
"""

import json
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(50), unique=True, nullable=False),
        sa.Column("limits", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("price_cents", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(320), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(128), nullable=False),
        sa.Column("plan_id", sa.Integer, sa.ForeignKey("plans.id"), nullable=False, server_default="1"),
        sa.Column("api_key", sa.String(64), unique=True, nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("input_url", sa.Text, nullable=True),
        sa.Column("output_url", sa.Text, nullable=True),
        sa.Column("metadata", postgresql.JSON(), nullable=True, server_default="{}"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "usage_logs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("job_type", sa.String(50), nullable=False),
        sa.Column("credits_used", sa.Integer, nullable=False, server_default="1"),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "billing",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="inactive"),
    )

    op.create_table(
        "webhooks",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("events", postgresql.ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("secret", sa.String(128), nullable=False),
        sa.Column("active", sa.Boolean, nullable=False, server_default="true"),
    )

    plans_table = sa.table(
        "plans",
        sa.column("name", sa.String),
        sa.column("limits", postgresql.JSON),
        sa.column("price_cents", sa.Integer),
    )

    op.bulk_insert(
        plans_table,
        [
            {
                "name": "free",
                "limits": json.dumps({"max_jobs_per_month": 50, "max_file_size_mb": 10}),
                "price_cents": 0,
            },
            {
                "name": "pro",
                "limits": json.dumps({"max_jobs_per_month": 1000, "max_file_size_mb": 100}),
                "price_cents": 1999,
            },
            {
                "name": "business",
                "limits": json.dumps({"max_jobs_per_month": -1, "max_file_size_mb": 500}),
                "price_cents": 4999,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("webhooks")
    op.drop_table("billing")
    op.drop_table("usage_logs")
    op.drop_table("jobs")
    op.drop_table("users")
    op.drop_table("plans")
