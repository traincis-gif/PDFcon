export type JobStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export type OperationType =
  | 'merge'
  | 'split'
  | 'compress'
  | 'convert_to_png'
  | 'convert_to_jpg'
  | 'convert_to_txt'
  | 'convert_to_docx'
  | 'convert_to_xlsx'
  | 'convert_to_pptx'
  | 'docx_to_pdf'
  | 'xlsx_to_pdf'
  | 'pptx_to_pdf'
  | 'html_to_pdf'
  | 'img_to_pdf'
  | 'add_text'
  | 'watermark'
  | 'rotate'
  | 'reorder'
  | 'page_numbers'
  | 'encrypt'
  | 'flatten'
  | 'redact'
  | 'sign'
  | 'ocr'
  | 'edit_text';

export interface User {
  id: string;
  email: string;
  plan: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Job {
  id: string;
  userId?: string;
  type: string;
  operation?: string;
  status: JobStatus;
  inputUrl?: string;
  outputUrl?: string;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
  error_message?: string;
  fileName?: string;
  file_name?: string;
  fileNames?: string[];
  file_names?: string[];
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
  expiresAt?: string;
}

export interface JobsResponse {
  jobs: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UploadResponse {
  id?: string;
  job_id?: string;
  status: string;
}

export interface ProgressResponse {
  progress: number;
  status: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface TextEdit {
  page: number;        // 0-indexed
  originalText: string;
  newText: string;
  x: number;           // PDF coordinates
  y: number;
  width: number;       // original text box width
  height: number;      // original text box height
  fontSize: number;
}

export interface RichTextPlacement {
  text: string;
  page: number;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color: string;
  alignment: 'left' | 'center' | 'right';
  lineHeight: number;
  opacity: number;
}
