export type JobStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export type OperationType = 'merge' | 'split' | 'compress' | 'convert_to_png';

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
  userId: string;
  type: string;
  status: JobStatus;
  inputUrl?: string;
  outputUrl?: string;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
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
  id: string;
  status: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
