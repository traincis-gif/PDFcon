import type { Job, JobsResponse, UploadResponse, ProgressResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

class ApiClient {
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
      throw new Error(error.error?.message || error.message || 'Request failed');
    }

    return res.json();
  }

  async getJobs(): Promise<JobsResponse> {
    return this.request<JobsResponse>('/jobs');
  }

  async getJob(id: string): Promise<Job> {
    return this.request<Job>(`/jobs/${id}`);
  }

  async getJobProgress(id: string): Promise<ProgressResponse> {
    return this.request<ProgressResponse>(`/jobs/${id}/progress`);
  }

  async uploadAndProcess(
    files: File[],
    operation: string,
    onProgress?: (percent: number) => void,
    metadata?: Record<string, unknown>
  ): Promise<UploadResponse> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('operation', operation);

    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/upload`);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error?.message || 'Upload failed'));
          } catch {
            reject(new Error('Upload failed'));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });
  }

  /**
   * Batch upload and process multiple files with the same operation.
   * Creates a separate job for each file.
   * Returns an array of job IDs.
   */
  async batchUploadAndProcess(
    files: File[],
    operation: string,
    onFileProgress?: (fileIndex: number, percent: number) => void,
    metadata?: Record<string, unknown>
  ): Promise<string[]> {
    const jobIds: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const res = await this.uploadAndProcess(
        [files[i]],
        operation,
        (pct) => {
          if (onFileProgress) onFileProgress(i, pct);
        },
        metadata
      );
      const id = res.job_id || res.id;
      if (id) jobIds.push(id);
    }

    return jobIds;
  }

  getDownloadUrl(jobId: string): string {
    return `${API_URL}/jobs/${jobId}/download`;
  }
}

export const api = new ApiClient();
