import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.models import Job, Plan


@pytest.mark.asyncio
class TestJobEndpoints:
    async def test_list_jobs_unauthenticated(self, client):
        response = await client.get("/jobs")
        assert response.status_code == 401

    async def test_get_job_unauthenticated(self, client):
        fake_id = str(uuid.uuid4())
        response = await client.get(f"/jobs/{fake_id}")
        assert response.status_code == 401

    @patch("app.jobs.router.process_pdf_job")
    @patch("app.jobs.router.create_job")
    async def test_create_job_calls_service(self, mock_create, mock_task, authed_client, test_user):
        job_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        mock_job = MagicMock(spec=Job)
        mock_job.id = job_id
        mock_job.user_id = test_user.id
        mock_job.type = "compress"
        mock_job.status = "pending"
        mock_job.input_url = "uploads/test/input.pdf"
        mock_job.output_url = None
        mock_job.metadata_ = {}
        mock_job.error_message = None
        mock_job.created_at = now
        mock_job.updated_at = now
        mock_job.expires_at = now

        mock_create.return_value = mock_job
        mock_task.delay = MagicMock()

        response = await authed_client.post("/jobs", json={
            "type": "compress",
            "input_url": "uploads/test/input.pdf",
        })

        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "compress"
        assert data["status"] == "pending"
        assert data["id"] == str(job_id)
        mock_task.delay.assert_called_once_with(str(job_id))

    async def test_create_job_missing_type(self, authed_client):
        response = await authed_client.post("/jobs", json={"input_url": "test"})
        assert response.status_code == 422


@pytest.mark.asyncio
class TestPresignUpload:
    @patch("app.jobs.router.generate_presigned_download")
    @patch("app.jobs.router.generate_presigned_upload")
    async def test_presign_upload(self, mock_upload, mock_download, authed_client):
        mock_upload.return_value = "https://r2.example.com/upload?signed=1"
        mock_download.return_value = "https://r2.example.com/download?signed=1"

        response = await authed_client.post("/jobs/presign-upload?filename=test.pdf")
        assert response.status_code == 200
        data = response.json()
        assert "upload_url" in data
        assert "object_key" in data
        assert "download_url" in data
        assert "test.pdf" in data["object_key"]


class TestPdfServices:
    def test_merge_pdfs(self):
        from pypdf import PdfWriter
        import io

        pdfs = []
        for i in range(3):
            writer = PdfWriter()
            writer.add_blank_page(width=200, height=200)
            buf = io.BytesIO()
            writer.write(buf)
            pdfs.append(buf.getvalue())

        from app.services.pdf_merge import merge_pdfs
        result = merge_pdfs(pdfs)
        assert isinstance(result, bytes)
        assert len(result) > 0

        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(result))
        assert len(reader.pages) == 3

    def test_split_pdf_all_pages(self):
        from pypdf import PdfWriter, PdfReader
        import io

        writer = PdfWriter()
        for _ in range(5):
            writer.add_blank_page(width=200, height=200)
        buf = io.BytesIO()
        writer.write(buf)
        pdf_bytes = buf.getvalue()

        from app.services.pdf_split import split_pdf
        parts = split_pdf(pdf_bytes)
        assert len(parts) == 5
        for part in parts:
            reader = PdfReader(io.BytesIO(part))
            assert len(reader.pages) == 1

    def test_split_pdf_specific_pages(self):
        from pypdf import PdfWriter, PdfReader
        import io

        writer = PdfWriter()
        for _ in range(5):
            writer.add_blank_page(width=200, height=200)
        buf = io.BytesIO()
        writer.write(buf)
        pdf_bytes = buf.getvalue()

        from app.services.pdf_split import split_pdf
        parts = split_pdf(pdf_bytes, pages=[1, 3])
        assert len(parts) == 2

    def test_split_pdf_ranges(self):
        from pypdf import PdfWriter, PdfReader
        import io

        writer = PdfWriter()
        for _ in range(5):
            writer.add_blank_page(width=200, height=200)
        buf = io.BytesIO()
        writer.write(buf)
        pdf_bytes = buf.getvalue()

        from app.services.pdf_split import split_pdf
        parts = split_pdf(pdf_bytes, ranges=[(1, 3), (4, 5)])
        assert len(parts) == 2
        reader1 = PdfReader(io.BytesIO(parts[0]))
        assert len(reader1.pages) == 3
        reader2 = PdfReader(io.BytesIO(parts[1]))
        assert len(reader2.pages) == 2

    def test_compress_pdf(self):
        from pypdf import PdfWriter
        import io

        writer = PdfWriter()
        writer.add_blank_page(width=200, height=200)
        buf = io.BytesIO()
        writer.write(buf)
        pdf_bytes = buf.getvalue()

        from app.services.pdf_compress import compress_pdf
        result = compress_pdf(pdf_bytes)
        assert isinstance(result, bytes)
        assert len(result) > 0
