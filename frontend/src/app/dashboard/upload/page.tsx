'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileDropzone } from '@/components/file-dropzone';
import { OperationPicker } from '@/components/operation-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import type { OperationType } from '@/types';

export default function UploadPage() {
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

      toast({ title: 'Job started', description: 'Your files are being processed.' });
      router.push(`/dashboard/jobs/${res.job_id}`);
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Choose Operation</CardTitle>
          <CardDescription>What would you like to do with your files?</CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Upload Files</CardTitle>
          <CardDescription>
            {isMultiple
              ? 'Upload 2 or more files to merge together'
              : 'Upload a file to process'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileDropzone
            files={files}
            onFilesChange={setFiles}
            multiple={isMultiple}
          />
        </CardContent>
      </Card>

      {uploading && (
        <Card>
          <CardContent className="py-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="gap-2"
        >
          {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
          {uploading ? 'Uploading...' : 'Start Processing'}
        </Button>
      </div>
    </div>
  );
}
