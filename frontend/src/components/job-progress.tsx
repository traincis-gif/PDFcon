'use client';

import React, { useEffect } from 'react';
import { useJobStatus } from '@/lib/hooks';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { operationLabel } from '@/lib/utils';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Download,
  RotateCcw,
  Upload,
  Clock,
} from 'lucide-react';

interface JobProgressProps {
  /** Upload progress (0-100), shown before job is created */
  uploadProgress: number;
  /** Whether currently uploading */
  isUploading: boolean;
  /** Job ID returned by the upload, null if not yet submitted */
  jobId: string | null;
  /** Called when user wants to process a new file or apply another tool */
  onReset: () => void;
  /** Called when job completes successfully */
  onComplete?: () => void;
  /** Error from the upload itself (not job processing) */
  uploadError: string | null;
}

export function JobProgress({
  uploadProgress,
  isUploading,
  jobId,
  onReset,
  onComplete,
  uploadError,
}: JobProgressProps) {
  const { data: job } = useJobStatus(jobId || '');
  const status = job?.status?.toLowerCase();
  const jobOperation = job?.operation || job?.type || '';
  const jobErrorMessage = job?.error_message || job?.errorMessage;

  useEffect(() => {
    if (status === 'done' && onComplete) {
      onComplete();
    }
  }, [status, onComplete]);

  // Upload error state
  if (uploadError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">Upload Failed</p>
            <p className="text-sm text-destructive/80 mt-0.5">{uploadError}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onReset} className="shrink-0 gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Uploading state
  if (isUploading) {
    return (
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Upload className="h-4 w-4 text-primary animate-pulse" />
            Uploading your file...
          </span>
          <span className="font-semibold text-primary tabular-nums">{uploadProgress}%</span>
        </div>
        <Progress value={uploadProgress} />
        {uploadProgress === 100 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            Upload complete, starting processing...
          </p>
        )}
      </div>
    );
  }

  // No job yet
  if (!jobId || !job) {
    return null;
  }

  // Job pending
  if (status === 'pending') {
    return (
      <div className="rounded-lg border border-yellow-500/20 bg-yellow-50/50 dark:bg-yellow-900/10 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
          <Clock className="h-4 w-4" />
          Queued - waiting to process {operationLabel(jobOperation)}
        </div>
        <Progress value={15} />
      </div>
    );
  }

  // Job processing
  if (status === 'processing') {
    return (
      <div className="rounded-lg border border-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing: {operationLabel(jobOperation)}...
        </div>
        <Progress indeterminate />
      </div>
    );
  }

  // Job failed
  if (status === 'failed') {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">Processing Failed</p>
            {jobErrorMessage && (
              <p className="text-sm text-destructive/80 mt-0.5">{jobErrorMessage}</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onReset} className="shrink-0 gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Job done
  if (status === 'done') {
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-50/50 dark:bg-green-900/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                Done! Your file is ready.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {operationLabel(jobOperation)} completed successfully.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => window.open(api.getDownloadUrl(job.id), '_blank')}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              New
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
