import io

from pypdf import PdfReader, PdfWriter


def compress_pdf(pdf_bytes: bytes) -> bytes:
    """Compress a PDF by removing duplication and compressing page content streams."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()

    for page in reader.pages:
        page.compress_content_streams()
        writer.add_page(page)

    writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()
