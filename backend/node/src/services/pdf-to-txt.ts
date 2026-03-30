import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

// Disable the worker thread since we are running in Node.js
GlobalWorkerOptions.workerSrc = "";

/**
 * Extract plain text from all pages of a PDF.
 *
 * Uses pdfjs-dist to parse the PDF and retrieve text content.
 * Pages are separated by a line of dashes and a "--- Page N ---" header.
 */
export async function extractText(pdfBuffer: Buffer): Promise<string> {
  const data = new Uint8Array(pdfBuffer);
  const doc = await getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;

  const totalPages = doc.numPages;
  const parts: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    const pageText = content.items
      .filter((item: any) => "str" in item)
      .map((item: any) => item.str)
      .join(" ");

    parts.push(`--- Page ${i} ---\n${pageText}`);
  }

  await doc.destroy();

  return parts.join("\n\n");
}
