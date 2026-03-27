'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useJobStatus } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';

const statusConfig: Record<
  string,
  { icon: React.ReactNode; label: string; progress: number }
> = {
  pending: {
    icon: <Clock className="h-8 w-8 text-yellow-500" />,
    label: 'Queued',
    progress: 15,
  },
  processing: {
    icon: <Cog className="h-8 w-8 text-blue-500 animate-spin" />,
    label: 'Processing',
    progress: 60,
  },
  done: {
    icon: <CheckCircle2 className="h-8 w-8 text-green-500" />,
    label: 'Completed',
    progress: 100,
  },
  failed: {
    icon: <XCircle className="h-8 w-8 text-red-500" />,
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          <CardContent className="py-10 text-center">
            <p className="text-destructive">Failed to load job details.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = statusConfig[job.status] || statusConfig.pending;

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
          <div className="flex flex-col items-center text-center py-4">
            {config.icon}
            <h3 className="text-lg font-semibold mt-3">{config.label}</h3>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold mt-2 ${statusColor(
                job.status
              )}`}
            >
              {job.status}
            </span>
            {(job.status === 'pending' || job.status === 'processing') && (
              <div className="w-full max-w-xs mt-4">
                <Progress value={config.progress} />
                <p className="text-xs text-muted-foreground mt-2">
                  {job.status === 'pending'
                    ? 'Waiting in queue...'
                    : 'Processing your files...'}
                </p>
              </div>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
            <div>
              <p className="text-xs text-muted-foreground">Operation</p>
              <p className="text-sm font-medium">{operationLabel(job.operation)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm font-medium">{formatDate(job.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">File(s)</p>
              <p className="text-sm font-medium truncate">
                {job.file_names?.join(', ') || job.file_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Updated</p>
              <p className="text-sm font-medium">{formatDate(job.updated_at)}</p>
            </div>
          </div>

          {/* Error */}
          {job.status === 'failed' && job.error_message && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm p-4">
              <p className="font-medium mb-1">Error</p>
              <p>{job.error_message}</p>
            </div>
          )}

          {/* Download */}
          {job.status === 'done' && (
            <div className="flex justify-center pt-2">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => window.open(api.getDownloadUrl(job.id), '_blank')}
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
