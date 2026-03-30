'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { formatDate, operationLabel, statusColor } from '@/lib/utils';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Job } from '@/types';

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  const status = job.status.toLowerCase();
  const jobOperation = job.operation || job.type || '';
  const jobCreatedAt = job.createdAt || job.created_at || '';
  const jobErrorMessage = job.error_message || job.errorMessage;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(
                  job.status
                )}`}
              >
                {status === 'processing' && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                {status}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {operationLabel(jobOperation)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(jobCreatedAt)}
            </p>
            {jobErrorMessage && (
              <p className="text-xs text-destructive mt-1 truncate">
                {jobErrorMessage}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status === 'done' && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(api.getDownloadUrl(job.id), '_blank');
                }}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            )}
            <Link href={`/dashboard/jobs/${job.id}`}>
              <Button size="sm" variant="ghost">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
