import type { OperationType } from '@/types';

export type FileCategory = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image';

const extensionMap: Record<string, FileCategory> = {
  '.pdf': 'pdf',
  '.doc': 'word',
  '.docx': 'word',
  '.xls': 'excel',
  '.xlsx': 'excel',
  '.ppt': 'powerpoint',
  '.pptx': 'powerpoint',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
};

const mimeMap: Record<string, FileCategory> = {
  'application/pdf': 'pdf',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-powerpoint': 'powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
};

export function detectFileType(file: File): FileCategory {
  // Check extension first
  const name = file.name.toLowerCase();
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex !== -1) {
    const ext = name.slice(dotIndex);
    const category = extensionMap[ext];
    if (category) return category;
  }

  // MIME fallback
  if (file.type) {
    const category = mimeMap[file.type];
    if (category) return category;
  }

  // Default to PDF
  return 'pdf';
}

export const toolsForFileType: Record<FileCategory, OperationType[]> = {
  pdf: [
    'edit_text',
    'add_text',
    'watermark',
    'sign',
    'redact',
    'merge',
    'split',
    'rotate',
    'reorder',
    'page_numbers',
    'compress',
    'flatten',
    'encrypt',
    'convert_to_docx',
    'convert_to_xlsx',
    'convert_to_pptx',
    'convert_to_png',
    'convert_to_jpg',
    'convert_to_txt',
    'ocr',
  ],
  word: ['docx_to_pdf'],
  excel: ['xlsx_to_pdf'],
  powerpoint: ['pptx_to_pdf'],
  image: ['img_to_pdf', 'ocr'],
};

/** Get the primary/default tool for a file category */
export function getDefaultTool(category: FileCategory): OperationType | null {
  switch (category) {
    case 'word':
      return 'docx_to_pdf';
    case 'excel':
      return 'xlsx_to_pdf';
    case 'powerpoint':
      return 'pptx_to_pdf';
    case 'image':
      return 'img_to_pdf';
    default:
      return null;
  }
}

/**
 * Operations that support batch processing -- each file is processed
 * independently (as opposed to merge which combines files).
 */
export const batchOperations = new Set<OperationType>([
  'compress',
]);

/** Check whether an operation supports batch mode */
export function isBatchOperation(op: OperationType): boolean {
  return batchOperations.has(op);
}
