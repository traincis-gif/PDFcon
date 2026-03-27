'use client';

import React from 'react';
import Link from 'next/link';
import { Badge } from './ui/badge';
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
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(job.status)}`}>
                {job.status === 'processing' && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                {job.status}
              </span>
              <span className="text-xs text-muted-foreground">
                {operationLabel(job.operation)}
              </span>
            </div>
            <p className="text-sm font-medium truncate">
              {job.file_names?.join(', ') || job.file_name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(job.created_at)}
            </p>
            {job.error_message && (
              <p className="text-xs text-destructive mt-1">{job.error_message}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {job.status === 'done' && (
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
