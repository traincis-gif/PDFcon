from datetime import datetime
from typing import Any

from pydantic import BaseModel


class JobCreateRequest(BaseModel):
    type: str  # merge, split, compress, pdf_to_png
    input_url: str
    metadata: dict[str, Any] = {}


class JobResponse(BaseModel):
    id: str
    user_id: str
    type: str
    status: str
    input_url: str | None
    output_url: str | None
    metadata: dict[str, Any] | None
    error_message: str | None
    created_at: str
    updated_at: str
    expires_at: str | None

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    jobs: list[JobResponse]
    total: int
    page: int
    per_page: int


class PresignedUploadResponse(BaseModel):
    upload_url: str
    object_key: str
    download_url: str
