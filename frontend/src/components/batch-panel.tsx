'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { useJobStatus, useJobProgress } from '@/lib/hooks';
import { formatBytes, operationLabel } from '@/lib/utils';
import {
  FileIcon,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  Upload,
  Package,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OperationType } from '@/types';

export interface BatchFile {
  file: File;
  jobId: string | null;
  uploadProgress: number;
  status: 'waiting' | 'uploading' | 'processing' | 'done' | 'failed';
  error?: string;
}

interface BatchPanelProps {
  operation: OperationType;
  initialFile: File;
  onClose: () => void;
}

/** Monitors a single job's progress */
function BatchFileRow({ entry, index }: { entry: BatchFile; index: number }) {
  const { data: job } = useJobStatus(entry.jobId || '');
  const { data: progressData } = useJobProgress(entry.jobId || '');
  const processingProgress = progressData?.progress ?? 0;

  const jobStatus = job?.status?.toLowerCase();

  let statusIcon: React.ReactNode;
  let statusText: string;
  let progressValue: number | undefined;

  if (entry.status === 'waiting') {
    statusIcon = <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    statusText = 'Waiting';
  } else if (entry.status === 'uploading') {
    statusIcon = <Upload className="h-3.5 w-3.5 text-primary animate-pulse" />;
    statusText = `Uploading ${entry.uploadProgress}%`;
    progressValue = entry.uploadProgress;
  } else if (entry.status === 'failed') {
    statusIcon = <XCircle className="h-3.5 w-3.5 text-destructive" />;
    statusText = 'Failed';
  } else if (jobStatus === 'done' || entry.status === 'done') {
    statusIcon = <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    statusText = 'Done';
    progressValue = 100;
  } else if (jobStatus === 'failed') {
    statusIcon = <XCircle className="h-3.5 w-3.5 text-destructive" />;
    statusText = 'Failed';
  } else if (jobStatus === 'processing') {
    statusIcon = <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />;
    statusText = `Processing ${processingProgress}%`;
    progressValue = Math.max(processingProgress, 5);
  } else if (jobStatus === 'pending') {
    statusIcon = <Clock className="h-3.5 w-3.5 text-yellow-600" />;
    statusText = 'Queued';
    progressValue = 10;
  } else {
    statusIcon = <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />;
    statusText = 'Processing...';
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/30 border">
      <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{entry.file.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{formatBytes(entry.file.size)}</span>
          <span className="flex items-center gap-1 text-xs">
            {statusIcon}
            <span className="text-muted-foreground">{statusText}</span>
          </span>
        </div>
        {progressValue !== undefined && progressValue < 100 && (
          <Progress value={progressValue} className="mt-1.5 h-1.5" />
        )}
      </div>
      {(jobStatus === 'done' || entry.status === 'done') && entry.jobId && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 shrink-0"
          onClick={() => window.open(api.getDownloadUrl(entry.jobId!), '_blank')}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function BatchPanel({ operation, initialFile, onClose }: BatchPanelProps) {
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([
    {
      file: initialFile,
      jobId: null,
      uploadProgress: 0,
      status: 'waiting',
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [allDone, setAllDone] = useState(false);

  // Add more files
  const handleAddFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files).map((f) => ({
      file: f,
      jobId: null as string | null,
      uploadProgress: 0,
      status: 'waiting' as const,
    }));
    setBatchFiles((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setBatchFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Start batch processing
  const handleCompressAll = useCallback(async () => {
    setIsProcessing(true);

    for (let i = 0; i < batchFiles.length; i++) {
      if (batchFiles[i].jobId) continue; // already processed

      setBatchFiles((prev) => {
        const updated = [...prev];
        updated[i] = { ...updated[i], status: 'uploading' };
        return updated;
      });

      try {
        const res = await api.uploadAndProcess(
          [batchFiles[i].file],
          operation,
          (pct) => {
            setBatchFiles((prev) => {
              const updated = [...prev];
              updated[i] = { ...updated[i], uploadProgress: pct };
              return updated;
            });
          }
        );
        const id = res.job_id || res.id;
        setBatchFiles((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], jobId: id || null, status: 'processing' };
          return updated;
        });
      } catch (err: any) {
        setBatchFiles((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], status: 'failed', error: err.message };
          return updated;
        });
      }
    }

    setIsProcessing(false);
  }, [batchFiles, operation]);

  // Poll to check if all jobs are done
  useEffect(() => {
    if (!isProcessing && batchFiles.every((f) => f.jobId || f.status === 'failed')) {
      // Check periodically if all are done
      const interval = setInterval(async () => {
        let allComplete = true;
        for (const f of batchFiles) {
          if (f.status === 'failed') continue;
          if (!f.jobId) { allComplete = false; continue; }
          try {
            const job = await api.getJob(f.jobId);
            const s = job.status.toLowerCase();
            if (s !== 'done' && s !== 'failed') allComplete = false;
          } catch {
            allComplete = false;
          }
        }
        if (allComplete) {
          setAllDone(true);
          clearInterval(interval);
        }
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [isProcessing, batchFiles]);

  const hasMultipleFiles = batchFiles.length > 1;
  const allHaveJobs = batchFiles.every((f) => f.jobId || f.status === 'failed');

  // Download all as ZIP -- open all download URLs (browser handles multiple)
  const handleDownloadAll = useCallback(() => {
    for (const f of batchFiles) {
      if (f.jobId && f.status !== 'failed') {
        window.open(api.getDownloadUrl(f.jobId), '_blank');
      }
    }
  }, [batchFiles]);

  return (
    <div className="absolute inset-0 z-40 bg-background/95 backdrop-blur flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">Batch {operationLabel(operation)}</h3>
            <p className="text-xs text-muted-foreground">
              {batchFiles.length} file{batchFiles.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isProcessing && !allHaveJobs && (
            <label className="cursor-pointer">
              <input
                type="file"
                className="hidden"
                multiple
                accept=".pdf"
                onChange={handleAddFiles}
              />
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors">
                <Upload className="h-3 w-3" />
                Add files
              </div>
            </label>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {batchFiles.map((entry, index) => (
          <div key={index} className="relative">
            <BatchFileRow entry={entry} index={index} />
            {!isProcessing && !entry.jobId && entry.status === 'waiting' && batchFiles.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveFile(index)}
                className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-full bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t bg-muted/20 flex items-center gap-2 shrink-0">
        {!allHaveJobs && (
          <Button
            onClick={handleCompressAll}
            disabled={isProcessing || batchFiles.length === 0}
            className="gap-2 flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                {operationLabel(operation)} All ({batchFiles.length})
              </>
            )}
          </Button>
        )}
        {allDone && (
          <Button onClick={handleDownloadAll} className="gap-2 flex-1">
            <Download className="h-4 w-4" />
            Download All ({batchFiles.filter((f) => f.jobId).length} files)
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          {allDone ? 'Done' : 'Cancel'}
        </Button>
      </div>
    </div>
  );
}
