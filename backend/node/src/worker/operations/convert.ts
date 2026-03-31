import { OperationHandler } from "./index";
import { convertWithLibreOffice } from "../../services/convert-libreoffice";

interface ConversionSpec {
  inputFormat: string;
  outputFormat: string;
  outputFilename: string;
  contentType: string;
  label: string;
}

const CONVERSIONS: Record<string, ConversionSpec> = {
  PDF_TO_DOCX: {
    inputFormat: "pdf",
    outputFormat: "docx",
    outputFilename: "converted.docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "PDF to DOCX",
  },
  PDF_TO_XLSX: {
    inputFormat: "pdf",
    outputFormat: "xlsx",
    outputFilename: "converted.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "PDF to XLSX",
  },
  PDF_TO_PPTX: {
    inputFormat: "pdf",
    outputFormat: "pptx",
    outputFilename: "converted.pptx",
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    label: "PDF to PPTX",
  },
  DOCX_TO_PDF: {
    inputFormat: "docx",
    outputFormat: "pdf",
    outputFilename: "converted.pdf",
    contentType: "application/pdf",
    label: "DOCX to PDF",
  },
  XLSX_TO_PDF: {
    inputFormat: "xlsx",
    outputFormat: "pdf",
    outputFilename: "converted.pdf",
    contentType: "application/pdf",
    label: "XLSX to PDF",
  },
  PPTX_TO_PDF: {
    inputFormat: "pptx",
    outputFormat: "pdf",
    outputFilename: "converted.pdf",
    contentType: "application/pdf",
    label: "PPTX to PDF",
  },
  HTML_TO_PDF: {
    inputFormat: "html",
    outputFormat: "pdf",
    outputFilename: "converted.pdf",
    contentType: "application/pdf",
    label: "HTML to PDF",
  },
};

function makeConvertHandler(spec: ConversionSpec): OperationHandler {
  return async (jobId, metadata, ctx) => {
    const inputKey = requireFileKey(metadata, spec.label);
    ctx.reportProgress(10);
    const inputBuffer = await ctx.getFile(inputKey);
    ctx.reportProgress(30);
    const outputBuffer = await convertWithLibreOffice(inputBuffer, spec.inputFormat, spec.outputFormat);
    ctx.reportProgress(85);
    const outputKey = `${metadata._outputBase}/${spec.outputFilename}`;
    await ctx.putFile(outputKey, outputBuffer, spec.contentType);
    await ctx.updateStatus(jobId, "DONE", {
      outputUrl: outputKey,
      metadata: { ...metadata, size: outputBuffer.length },
    });
    ctx.reportProgress(100);
    return { outputKey, contentType: spec.contentType };
  };
}

function requireFileKey(metadata: Record<string, any>, label: string): string {
  if (!metadata.fileKeys || metadata.fileKeys.length === 0) {
    throw new Error(`Input file key required for ${label}`);
  }
  return metadata.fileKeys[0];
}

export const convertHandlers: Record<string, OperationHandler> = {};
for (const [type, spec] of Object.entries(CONVERSIONS)) {
  convertHandlers[type] = makeConvertHandler(spec);
}
