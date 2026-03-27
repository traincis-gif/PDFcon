'use client';

import React from 'react';
import Link from 'next/link';
import { useJobs } from '@/lib/hooks';
import { JobCard } from '@/components/job-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Loader2, FileX } from 'lucide-react';

export default function DashboardPage() {
  const { data, isLoading, error } = useJobs();

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

      {data && data.jobs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <FileX className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No jobs yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload a document to get started with your first processing job.
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

      {data && data.jobs.length > 0 && (
        <div className="space-y-3">
          {data.jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
