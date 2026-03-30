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
  | 'ocr';

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

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
