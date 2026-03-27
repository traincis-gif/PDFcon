import io

from pypdf import PdfReader, PdfWriter


def merge_pdfs(pdf_bytes_list: list[bytes]) -> bytes:
    """Merge multiple PDF byte streams into a single PDF."""
    writer = PdfWriter()

    for pdf_bytes in pdf_bytes_list:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages:
            writer.add_page(page)

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()
