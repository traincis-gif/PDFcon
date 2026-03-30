'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useJobStatus } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatDate, operationLabel, statusColor } from '@/lib/utils';
import { api } from '@/lib/api';
import {
  ArrowLeft,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Cog,
  AlertTriangle,
} from 'lucide-react';

const statusConfig: Record<
  string,
  { icon: React.ReactNode; label: string; progress: number }
> = {
  pending: {
    icon: (
      <div className="relative">
        <Clock className="h-10 w-10 text-yellow-500" />
        <span className="absolute inset-0 rounded-full border-2 border-yellow-400 animate-pulse-ring" />
      </div>
    ),
    label: 'Queued',
    progress: 15,
  },
  processing: {
    icon: (
      <div className="relative">
        <Cog className="h-10 w-10 text-blue-500 animate-spin" />
        <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-pulse-ring" />
      </div>
    ),
    label: 'Processing',
    progress: 60,
  },
  done: {
    icon: <CheckCircle2 className="h-10 w-10 text-green-500" />,
    label: 'Completed',
    progress: 100,
  },
  failed: {
    icon: <XCircle className="h-10 w-10 text-red-500" />,
    label: 'Failed',
    progress: 100,
  },
};

export default function JobDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: job, isLoading, error } = useJobStatus(id);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading job details...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/dashboard">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center py-10 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-destructive font-medium">
              Failed to load job details.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              The job may not exist or there was a network error.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = job.status.toLowerCase();
  const config = statusConfig[status] || statusConfig.pending;
  const jobOperation = job.operation || job.type || '';
  const jobCreatedAt = job.createdAt || job.created_at || '';
  const jobUpdatedAt = job.updatedAt || job.updated_at || '';
  const jobFileNames = job.file_names || job.fileNames;
  const jobFileName = job.file_name || job.fileName;
  const jobErrorMessage = job.error_message || job.errorMessage;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard">
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Job Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="flex flex-col items-center text-center py-6">
            {config.icon}
            <h3 className="text-lg font-semibold mt-4">{config.label}</h3>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold mt-2 ${statusColor(
                job.status
              )}`}
            >
              {status}
            </span>
            {(status === 'pending' || status === 'processing') && (
              <div className="w-full max-w-xs mt-5">
                <Progress value={config.progress} />
                <p className="text-xs text-muted-foreground mt-2">
                  {status === 'pending'
                    ? 'Waiting in queue...'
                    : 'Processing your files...'}
                </p>
              </div>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border p-4">
            <div>
              <p className="text-xs text-muted-foreground">Operation</p>
              <p className="text-sm font-medium">
                {operationLabel(jobOperation)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm font-medium">{formatDate(jobCreatedAt)}</p>
            </div>
            {(jobFileNames || jobFileName) && (
              <div>
                <p className="text-xs text-muted-foreground">File(s)</p>
                <p className="text-sm font-medium truncate">
                  {jobFileNames?.join(', ') || jobFileName}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Last Updated</p>
              <p className="text-sm font-medium">
                {formatDate(jobUpdatedAt)}
              </p>
            </div>
          </div>

          {/* Error */}
          {status === 'failed' && jobErrorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-sm p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive mb-1">
                    Processing Failed
                  </p>
                  <p className="text-destructive/80">{jobErrorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Download */}
          {status === 'done' && (
            <div className="flex justify-center pt-2">
              <Button
                size="lg"
                className="gap-2 text-base px-8"
                onClick={() =>
                  window.open(api.getDownloadUrl(job.id), '_blank')
                }
              >
                <Download className="h-5 w-5" />
                Download Result
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
