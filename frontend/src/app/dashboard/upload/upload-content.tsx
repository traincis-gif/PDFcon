'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileDropzone } from '@/components/file-dropzone';
import { OperationPicker } from '@/components/operation-picker';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import type { OperationType } from '@/types';

const operationHints: Record<OperationType, string> = {
  merge: 'Upload multiple PDF files to combine them into a single document.',
  split: 'Upload one PDF to split it into separate pages.',
  compress: 'Upload one PDF to reduce its file size.',
  convert_to_png: 'Upload a document to convert each page to a PNG image.',
};

export function UploadContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [operation, setOperation] = useState<OperationType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const isMultiple = operation === 'merge';

  const canSubmit = files.length > 0 && operation !== null && !uploading;

  const handleSubmit = async () => {
    if (!canSubmit || !operation) return;

    if (operation === 'merge' && files.length < 2) {
      toast({
        title: 'Need more files',
        description: 'Merge requires at least 2 files.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const res = await api.uploadAndProcess(files, operation, (pct) => {
        setProgress(pct);
      });

      toast({
        title: 'Job started',
        description: 'Your files are being processed.',
      });
      // Support both `id` and `job_id` from the API response
      const jobId = res.job_id || res.id;
      router.push(`/dashboard/jobs/${jobId}`);
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Files</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select an operation and upload your files
        </p>
      </div>

      {/* Step 1: Choose Operation */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
              1
            </span>
            <div>
              <CardTitle className="text-lg">Choose Operation</CardTitle>
              <CardDescription>
                What would you like to do with your files?
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <OperationPicker
            value={operation}
            onChange={(op) => {
              setOperation(op);
              if (op !== 'merge' && files.length > 1) {
                setFiles(files.slice(0, 1));
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Step 2: Upload Files */}
      <Card
        className={!operation ? 'opacity-60 pointer-events-none' : undefined}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
              2
            </span>
            <div>
              <CardTitle className="text-lg">Upload Files</CardTitle>
              <CardDescription>
                {operation
                  ? operationHints[operation]
                  : 'Select an operation first to continue.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FileDropzone
            files={files}
            onFilesChange={setFiles}
            multiple={isMultiple}
            disabled={!operation}
          />
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {uploading && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Uploading your files...
                </span>
                <span className="font-semibold text-primary">{progress}%</span>
              </div>
              <Progress value={progress} />
              {progress === 100 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Upload complete, starting processing...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="gap-2 min-w-[180px]"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              Start Processing
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
