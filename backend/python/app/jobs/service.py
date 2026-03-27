from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import Job, Plan, UsageLog, User

VALID_JOB_TYPES = {"merge", "split", "compress", "pdf_to_png"}


async def enforce_plan_limits(
    user: User,
    job_type: str,
    db: AsyncSession,
    settings: Settings,
) -> None:
    if job_type not in VALID_JOB_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "INVALID_JOB_TYPE", "message": f"Job type must be one of: {', '.join(sorted(VALID_JOB_TYPES))}", "details": {}}},
        )

    result = await db.execute(select(Plan).where(Plan.id == user.plan_id))
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "PLAN_NOT_FOUND", "message": "User plan configuration is missing", "details": {}}},
        )

    limits = plan.limits or {}
    max_jobs = limits.get("max_jobs_per_month")

    if max_jobs is not None and max_jobs != -1:
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        count_result = await db.execute(
            select(func.count(UsageLog.id))
            .where(UsageLog.user_id == user.id)
            .where(UsageLog.timestamp >= month_start)
        )
        current_count = count_result.scalar() or 0
        if current_count >= max_jobs:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"error": {"code": "PLAN_LIMIT_REACHED", "message": f"Monthly job limit of {max_jobs} reached", "details": {"current": current_count, "limit": max_jobs}}},
            )


async def create_job(
    user: User,
    job_type: str,
    input_url: str,
    metadata: dict,
    db: AsyncSession,
    settings: Settings,
) -> Job:
    await enforce_plan_limits(user, job_type, db, settings)

    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.default_job_expiry_hours)
    job = Job(
        user_id=user.id,
        type=job_type,
        status="pending",
        input_url=input_url,
        metadata_=metadata,
        expires_at=expires_at,
    )
    db.add(job)

    usage_log = UsageLog(
        user_id=user.id,
        job_type=job_type,
        credits_used=1,
    )
    db.add(usage_log)

    await db.flush()
    return job


async def get_job_by_id(job_id: str, user: User, db: AsyncSession) -> Job:
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "JOB_NOT_FOUND", "message": "Job not found", "details": {}}},
        )
    return job


async def list_jobs(
    user: User,
    db: AsyncSession,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Job], int]:
    count_result = await db.execute(
        select(func.count(Job.id)).where(Job.user_id == user.id)
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * per_page
    result = await db.execute(
        select(Job)
        .where(Job.user_id == user.id)
        .order_by(Job.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    jobs = list(result.scalars().all())
    return jobs, total
