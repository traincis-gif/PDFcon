import asyncio
import uuid
from datetime import datetime, timezone
from unittest.mock import patch, AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import StaticPool, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base, Plan, User
from app.auth.service import hash_password


# Use an in-memory SQLite for tests, but we need to patch out postgres-specific
# features. Instead, we mock the DB dependency directly.


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_settings():
    from app.config import Settings

    return Settings(
        database_url="postgresql+asyncpg://test:test@localhost/test",
        database_url_sync="postgresql+psycopg2://test:test@localhost/test",
        jwt_secret="test-secret-key-for-testing",
        r2_account_id="test-account",
        r2_access_key_id="test-key",
        r2_secret_access_key="test-secret",
        redis_url="redis://localhost:6379/15",
        celery_broker_url="redis://localhost:6379/15",
        celery_result_backend="redis://localhost:6379/15",
    )


@pytest.fixture
def test_user_id():
    return str(uuid.uuid4())


@pytest.fixture
def test_user(test_user_id):
    user = MagicMock(spec=User)
    user.id = uuid.UUID(test_user_id)
    user.email = "test@example.com"
    user.password_hash = hash_password("testpassword123")
    user.plan_id = 1
    user.api_key = None
    user.created_at = datetime.now(timezone.utc)
    return user


@pytest.fixture
def free_plan():
    plan = MagicMock(spec=Plan)
    plan.id = 1
    plan.name = "free"
    plan.limits = {"max_jobs_per_month": 50, "max_file_size_mb": 10}
    plan.price_cents = 0
    return plan


@pytest_asyncio.fixture
async def client(mock_settings, test_user):
    from app.main import app
    from app.config import get_settings
    from app.database import get_db
    from app.dependencies import get_current_user

    app.dependency_overrides[get_settings] = lambda: mock_settings

    async def mock_get_db():
        session = AsyncMock(spec=AsyncSession)
        yield session

    app.dependency_overrides[get_db] = mock_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def authed_client(mock_settings, test_user):
    from app.main import app
    from app.config import get_settings
    from app.database import get_db
    from app.dependencies import get_current_user

    app.dependency_overrides[get_settings] = lambda: mock_settings
    app.dependency_overrides[get_current_user] = lambda: test_user

    async def mock_get_db():
        session = AsyncMock(spec=AsyncSession)
        yield session

    app.dependency_overrides[get_db] = mock_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
