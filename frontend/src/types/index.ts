export type JobStatus = 'pending' | 'processing' | 'done' | 'failed';

export type OperationType = 'merge' | 'split' | 'compress' | 'convert_to_png';

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Job {
  id: string;
  user_id: string;
  operation: OperationType;
  status: JobStatus;
  file_name: string;
  file_names?: string[];
  result_url?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface JobsResponse {
  jobs: Job[];
  total: number;
}

export interface UploadResponse {
  job_id: string;
  message: string;
}

export interface ApiError {
  detail: string;
}
