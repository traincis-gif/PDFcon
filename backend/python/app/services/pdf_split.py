import io

from pypdf import PdfReader, PdfWriter


def split_pdf(pdf_bytes: bytes, pages: list[int] | None = None, ranges: list[tuple[int, int]] | None = None) -> list[bytes]:
    """Split a PDF into multiple PDFs.

    If `pages` is provided, each listed page becomes its own single-page PDF.
    If `ranges` is provided, each (start, end) tuple (1-indexed, inclusive) becomes a PDF.
    If neither is provided, every page becomes its own PDF.
    """
    reader = PdfReader(io.BytesIO(pdf_bytes))
    total_pages = len(reader.pages)
    results: list[bytes] = []

    if ranges:
        for start, end in ranges:
            writer = PdfWriter()
            for i in range(max(start - 1, 0), min(end, total_pages)):
                writer.add_page(reader.pages[i])
            buf = io.BytesIO()
            writer.write(buf)
            results.append(buf.getvalue())
    elif pages:
        for p in pages:
            if 1 <= p <= total_pages:
                writer = PdfWriter()
                writer.add_page(reader.pages[p - 1])
                buf = io.BytesIO()
                writer.write(buf)
                results.append(buf.getvalue())
    else:
        for i in range(total_pages):
            writer = PdfWriter()
            writer.add_page(reader.pages[i])
            buf = io.BytesIO()
            writer.write(buf)
            results.append(buf.getvalue())

    return results
