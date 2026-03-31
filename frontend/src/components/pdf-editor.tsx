'use client';

import React, { useState, useCallback } from 'react';
import { ToolSidebar, ToolBarMobile } from '@/components/tool-sidebar';
import { FileDropzone } from '@/components/file-dropzone';
import {
  ToolOptions,
  buildMetadata,
  validateOptions,
  defaultToolOptionsState,
} from '@/components/tool-options';
import type { ToolOptionsState } from '@/components/tool-options';
import { JobProgress } from '@/components/job-progress';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { operationLabel } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Zap,
  FileText,
  X,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import type { OperationType } from '@/types';

/** Operations that accept multiple files */
const multiFileOps = new Set<OperationType>(['merge', 'img_to_pdf']);

/** Operations that accept non-PDF input */
const nonPdfInputOps: Partial<Record<OperationType, string[]>> = {
  docx_to_pdf: ['.docx'],
  xlsx_to_pdf: ['.xlsx'],
  pptx_to_pdf: ['.pptx'],
  html_to_pdf: ['.html', '.htm'],
  img_to_pdf: ['.png', '.jpg', '.jpeg', '.webp'],
};

/** Get accepted extensions for a given operation */
function getAcceptedExtensions(op: OperationType | null): string[] | undefined {
  if (!op) return undefined; // accept all
  if (nonPdfInputOps[op]) return nonPdfInputOps[op];
  return ['.pdf'];
}

interface PdfEditorProps {
  initialFiles?: File[];
}

export function PdfEditor({ initialFiles }: PdfEditorProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>(initialFiles || []);
  const [selectedTool, setSelectedTool] = useState<OperationType | null>(null);
  const [toolOptions, setToolOptions] = useState<ToolOptionsState>(defaultToolOptionsState);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isMultiple = selectedTool !== null && multiFileOps.has(selectedTool);

  const handleToolSelect = useCallback(
    (tool: OperationType) => {
      setSelectedTool(tool);
      setJobId(null);
      setUploadError(null);
      setUploadProgress(0);
      setIsUploading(false);

      // Clear files if switching to a tool with different accepted types
      const currentAccepted = getAcceptedExtensions(selectedTool);
      const newAccepted = getAcceptedExtensions(tool);
      const currentSet = currentAccepted ? currentAccepted.join(',') : '';
      const newSet = newAccepted ? newAccepted.join(',') : '';
      if (currentSet !== newSet && files.length > 0) {
        // Check if existing files match the new tool's accepted types
        const exts = newAccepted || [];
        const allValid = files.every((f) => {
          const ext = '.' + f.name.split('.').pop()?.toLowerCase();
          return exts.length === 0 || exts.includes(ext);
        });
        if (!allValid) {
          setFiles([]);
        }
      }

      // If switching away from multi-file op, trim to one file
      if (!multiFileOps.has(tool) && files.length > 1) {
        setFiles(files.slice(0, 1));
      }
    },
    [selectedTool, files]
  );

  const canProcess = (() => {
    if (files.length === 0 || !selectedTool || isUploading || jobId) return false;
    if (selectedTool === 'merge' && files.length < 2) return false;
    return validateOptions(selectedTool, toolOptions);
  })();

  const handleProcess = async () => {
    if (!canProcess || !selectedTool) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setJobId(null);

    try {
      const metadata = buildMetadata(selectedTool, toolOptions);
      const res = await api.uploadAndProcess(files, selectedTool, (pct) => {
        setUploadProgress(pct);
      }, metadata);

      const id = res.job_id || res.id;
      if (id) {
        setJobId(id);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
      toast({
        title: 'Upload failed',
        description: err.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setJobId(null);
    setUploadError(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleFullReset = () => {
    handleReset();
    setFiles([]);
    setSelectedTool(null);
    setToolOptions(defaultToolOptionsState);
  };

  const acceptedExtensions = getAcceptedExtensions(selectedTool);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r bg-background transition-all duration-200 shrink-0',
          sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-56'
        )}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tools
          </span>
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="p-1 hover:bg-accent rounded-md transition-colors text-muted-foreground hover:text-foreground"
            title="Collapse sidebar"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        </div>
        <ToolSidebar
          selectedTool={selectedTool}
          onSelectTool={handleToolSelect}
          className="flex-1 overflow-hidden"
        />
      </aside>

      {/* Collapsed sidebar expand button */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="hidden lg:flex items-center justify-center w-8 border-r bg-background hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="Expand sidebar"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile tool bar */}
        <div className="lg:hidden border-b bg-background">
          <ToolBarMobile selectedTool={selectedTool} onSelectTool={handleToolSelect} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-5">
            {/* File area */}
            <section>
              <FileDropzone
                files={files}
                onFilesChange={setFiles}
                multiple={isMultiple}
                disabled={isUploading || !!jobId}
                mode="compact"
                acceptedExtensions={acceptedExtensions}
                hint={
                  selectedTool && nonPdfInputOps[selectedTool]
                    ? `Accepted formats: ${nonPdfInputOps[selectedTool]!.join(', ')}`
                    : undefined
                }
              />
            </section>

            {/* Tool not selected prompt */}
            {files.length > 0 && !selectedTool && (
              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
                <Zap className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="text-sm font-semibold mb-1">Select a tool to get started</h3>
                <p className="text-xs text-muted-foreground">
                  Pick a tool from the sidebar to process your file.
                </p>
              </div>
            )}

            {/* Tool options */}
            {selectedTool && (
              <section>
                <ToolOptions
                  tool={selectedTool}
                  options={toolOptions}
                  onOptionsChange={setToolOptions}
                />
              </section>
            )}

            {/* Merge hint */}
            {selectedTool === 'merge' && files.length > 0 && files.length < 2 && (
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-50/50 dark:bg-yellow-900/10 p-3">
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  Merge requires at least 2 files. Add more files above.
                </p>
              </div>
            )}

            {/* Process button */}
            {selectedTool && files.length > 0 && !jobId && (
              <div className="flex items-center gap-3">
                <Button
                  size="lg"
                  onClick={handleProcess}
                  disabled={!canProcess}
                  className="gap-2 flex-1 sm:flex-none sm:min-w-[200px]"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Process: {operationLabel(selectedTool)}
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handleFullReset}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            )}

            {/* Job progress */}
            {(isUploading || jobId || uploadError) && (
              <section>
                <JobProgress
                  uploadProgress={uploadProgress}
                  isUploading={isUploading}
                  jobId={jobId}
                  onReset={handleReset}
                  uploadError={uploadError}
                />
              </section>
            )}

            {/* After completion: apply another tool */}
            {jobId && (
              <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  <Zap className="h-4 w-4" />
                  Apply another tool to the same file
                </Button>
                <Button variant="ghost" onClick={handleFullReset} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Start with a new file
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
