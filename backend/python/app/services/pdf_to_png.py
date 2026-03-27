import io

from pdf2image import convert_from_bytes
from PIL import Image


def pdf_to_png(pdf_bytes: bytes, dpi: int = 150, pages: list[int] | None = None) -> list[bytes]:
    """Convert PDF pages to PNG images.

    Args:
        pdf_bytes: Raw PDF bytes.
        dpi: Resolution for rendering.
        pages: Optional 1-indexed page numbers to convert. Converts all if None.

    Returns:
        List of PNG byte strings, one per page.
    """
    kwargs: dict = {"fmt": "png", "dpi": dpi}
    if pages:
        kwargs["first_page"] = min(pages)
        kwargs["last_page"] = max(pages)

    images: list[Image.Image] = convert_from_bytes(pdf_bytes, **kwargs)

    results: list[bytes] = []
    for img in images:
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        results.append(buf.getvalue())

    return results
