from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.storage.r2 import generate_presigned_upload, generate_presigned_download
from app.worker.tasks import process_pdf_job

from .schemas import JobCreateRequest, JobListResponse, JobResponse, PresignedUploadResponse
from .service import create_job, get_job_by_id, list_jobs

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _job_to_response(job) -> JobResponse:
    return JobResponse(
        id=str(job.id),
        user_id=str(job.user_id),
        type=job.type,
        status=job.status,
        input_url=job.input_url,
        output_url=job.output_url,
        metadata=job.metadata_,
        error_message=job.error_message,
        created_at=job.created_at.isoformat(),
        updated_at=job.updated_at.isoformat(),
        expires_at=job.expires_at.isoformat() if job.expires_at else None,
    )


@router.post("", response_model=JobResponse, status_code=201)
async def create_new_job(
    body: JobCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    job = await create_job(
        user=current_user,
        job_type=body.type,
        input_url=body.input_url,
        metadata=body.metadata,
        db=db,
        settings=settings,
    )

    process_pdf_job.delay(str(job.id))

    return _job_to_response(job)


@router.get("", response_model=JobListResponse)
async def list_user_jobs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 20,
):
    jobs, total = await list_jobs(current_user, db, page, per_page)
    return JobListResponse(
        jobs=[_job_to_response(j) for j in jobs],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    job = await get_job_by_id(job_id, current_user, db)
    return _job_to_response(job)


@router.post("/presign-upload", response_model=PresignedUploadResponse)
async def presign_upload(
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    filename: str = "upload.pdf",
):
    import uuid

    object_key = f"uploads/{current_user.id}/{uuid.uuid4()}/{filename}"
    upload_url = generate_presigned_upload(object_key, settings)
    download_url = generate_presigned_download(object_key, settings)
    return PresignedUploadResponse(
        upload_url=upload_url,
        object_key=object_key,
        download_url=download_url,
    )
