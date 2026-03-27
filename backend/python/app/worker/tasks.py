import json
import uuid
import structlog
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Base, Job
from app.storage.r2 import download_file_bytes, upload_file_bytes
from app.services.pdf_merge import merge_pdfs
from app.services.pdf_split import split_pdf
from app.services.pdf_compress import compress_pdf
from app.services.pdf_to_png import pdf_to_png
from app.worker.celery_app import celery_app

logger = structlog.get_logger()

settings = get_settings()

sync_engine = create_engine(
    settings.database_url_sync,
    pool_size=5,
    max_overflow=5,
    pool_pre_ping=True,
)


def _get_sync_session() -> Session:
    return Session(sync_engine)


def _update_job_status(session: Session, job_id: str, status: str, **kwargs) -> None:
    result = session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one()
    job.status = status
    job.updated_at = datetime.now(timezone.utc)
    for key, value in kwargs.items():
        if key == "metadata":
            setattr(job, "metadata_", value)
        else:
            setattr(job, key, value)
    session.commit()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def process_pdf_job(self, job_id: str) -> dict:
    log = logger.bind(job_id=job_id, task_id=self.request.id)
    log.info("processing_job_started")

    session = _get_sync_session()
    try:
        result = session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if job is None:
            log.error("job_not_found")
            return {"status": "error", "message": "Job not found"}

        _update_job_status(session, job_id, "processing")
        job_type = job.type
        input_url = job.input_url
        metadata = job.metadata_ or {}

        log.info("downloading_input", job_type=job_type)
        input_bytes = download_file_bytes(input_url, settings)

        output_key_base = f"outputs/{job.user_id}/{job_id}"

        if job_type == "merge":
            additional_urls = metadata.get("additional_urls", [])
            pdf_list = [input_bytes]
            for url in additional_urls:
                pdf_list.append(download_file_bytes(url, settings))

            log.info("merging_pdfs", count=len(pdf_list))
            merged = merge_pdfs(pdf_list)
            output_key = f"{output_key_base}/merged.pdf"
            output_url = upload_file_bytes(output_key, merged, settings)

        elif job_type == "split":
            pages = metadata.get("pages")
            ranges = metadata.get("ranges")
            if ranges:
                ranges = [tuple(r) for r in ranges]

            log.info("splitting_pdf", pages=pages, ranges=ranges)
            parts = split_pdf(input_bytes, pages=pages, ranges=ranges)

            output_urls = []
            for i, part in enumerate(parts):
                key = f"{output_key_base}/part_{i + 1}.pdf"
                url = upload_file_bytes(key, part, settings)
                output_urls.append(url)

            output_url = output_urls[0] if len(output_urls) == 1 else json.dumps(output_urls)

        elif job_type == "compress":
            log.info("compressing_pdf")
            compressed = compress_pdf(input_bytes)
            output_key = f"{output_key_base}/compressed.pdf"
            output_url = upload_file_bytes(output_key, compressed, settings)

        elif job_type == "pdf_to_png":
            dpi = metadata.get("dpi", 150)
            target_pages = metadata.get("pages")

            log.info("converting_pdf_to_png", dpi=dpi, pages=target_pages)
            pngs = pdf_to_png(input_bytes, dpi=dpi, pages=target_pages)

            output_urls = []
            for i, png_data in enumerate(pngs):
                key = f"{output_key_base}/page_{i + 1}.png"
                url = upload_file_bytes(key, png_data, settings, content_type="image/png")
                output_urls.append(url)

            output_url = output_urls[0] if len(output_urls) == 1 else json.dumps(output_urls)

        else:
            _update_job_status(session, job_id, "failed", error_message=f"Unknown job type: {job_type}")
            log.error("unknown_job_type", job_type=job_type)
            return {"status": "failed", "message": f"Unknown job type: {job_type}"}

        _update_job_status(session, job_id, "done", output_url=output_url)
        log.info("job_completed", output_url=output_url)
        return {"status": "done", "job_id": job_id}

    except Exception as exc:
        log.error("job_failed", error=str(exc))
        try:
            _update_job_status(session, job_id, "failed", error_message=str(exc))
        except Exception:
            log.error("failed_to_update_job_status")
        raise self.retry(exc=exc)
    finally:
        session.close()
