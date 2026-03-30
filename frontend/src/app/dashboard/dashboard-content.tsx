'use client';

import React from 'react';
import Link from 'next/link';
import { useJobs } from '@/lib/hooks';
import { JobCard } from '@/components/job-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Loader2, FileX } from 'lucide-react';

export function DashboardContent() {
  const { data, isLoading, error } = useJobs();

  // Sort jobs by newest first
  const sortedJobs = React.useMemo(() => {
    if (!data?.jobs) return [];
    return [...data.jobs].sort((a, b) => {
      const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
      const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [data]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your recent document processing jobs
          </p>
        </div>
        <Link href="/dashboard/upload">
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            New Job
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="flex flex-col items-center py-10 text-center">
            <p className="text-destructive text-sm">
              Failed to load jobs. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {data && sortedJobs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <FileX className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No jobs yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Upload a file to get started! You can merge, split, compress, or
              convert PDFs to PNG.
            </p>
            <Link href="/dashboard/upload">
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Files
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {data && sortedJobs.length > 0 && (
        <div className="space-y-3">
          {sortedJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
