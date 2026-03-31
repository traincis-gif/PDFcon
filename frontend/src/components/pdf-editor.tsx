'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { ToolSidebar, ToolBarMobile } from '@/components/tool-sidebar';
import { FileDropzone } from '@/components/file-dropzone';
import { PdfViewer, FIT_WIDTH } from '@/components/pdf-viewer';
import type { InteractionMode, TextMarker, SignatureMarker } from '@/components/pdf-viewer';
import { ViewerToolbar } from '@/components/viewer-toolbar';
import { BottomPanel } from '@/components/bottom-panel';
import {
  buildMetadata,
  validateOptions,
  defaultToolOptionsState,
  isInteractiveTool,
} from '@/components/tool-options';
import type { ToolOptionsState } from '@/components/tool-options';
import { JobProgress } from '@/components/job-progress';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { operationLabel, formatBytes } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Zap,
  FileText,
  X,
  Download,
  Eye,
  FileIcon,
  Upload,
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

/** Operations whose output is NOT a PDF (so we can't preview result) */
const nonPdfOutputOps = new Set<OperationType>([
  'convert_to_png',
  'convert_to_jpg',
  'convert_to_txt',
  'convert_to_docx',
  'convert_to_xlsx',
  'convert_to_pptx',
]);

/** Get accepted extensions for a given operation */
function getAcceptedExtensions(op: OperationType | null): string[] | undefined {
  if (!op) return undefined;
  if (nonPdfInputOps[op]) return nonPdfInputOps[op];
  return ['.pdf'];
}

/** Check if file is a PDF */
function isPdfFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
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

  // PDF viewer state
  const [zoom, setZoom] = useState<number>(FIT_WIDTH);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const isMultiple = selectedTool !== null && multiFileOps.has(selectedTool);
  const primaryFile = files[0] || null;
  const canPreviewPdf = primaryFile && isPdfFile(primaryFile);

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

  const handleToolDeselect = useCallback(() => {
    setSelectedTool(null);
    setJobId(null);
    setUploadError(null);
    setUploadProgress(0);
    setIsUploading(false);
  }, []);

  // Interactive viewer callbacks
  const handleTextPlacement = useCallback(
    (page: number, x: number, y: number) => {
      setToolOptions((prev) => ({
        ...prev,
        textOptions: { ...prev.textOptions, page, x, y },
        textPlacementSet: true,
      }));
    },
    []
  );

  const handleRedactRectDrawn = useCallback(
    (page: number, x: number, y: number, width: number, height: number) => {
      setToolOptions((prev) => ({
        ...prev,
        redactOptions: {
          ...prev.redactOptions,
          regions: [...prev.redactOptions.regions, { page, x, y, width, height }],
        },
      }));
    },
    []
  );

  const handleSignPlacement = useCallback(
    (page: number, x: number, y: number) => {
      setToolOptions((prev) => ({
        ...prev,
        signOptions: { ...prev.signOptions, page, x, y },
        signPlacementSet: true,
      }));
    },
    []
  );

  // Build the interaction mode for the viewer based on selected tool
  const interactionMode: InteractionMode = useMemo(() => {
    if (!selectedTool || !canPreviewPdf || jobId) return { type: 'none' };

    switch (selectedTool) {
      case 'add_text':
        return { type: 'click', onPageClick: handleTextPlacement };
      case 'redact':
        return { type: 'draw-rect', onRectDrawn: handleRedactRectDrawn };
      case 'sign':
        return { type: 'click', onPageClick: handleSignPlacement };
      default:
        return { type: 'none' };
    }
  }, [selectedTool, canPreviewPdf, jobId, handleTextPlacement, handleRedactRectDrawn, handleSignPlacement]);

  // Build overlay markers for the viewer
  const textMarkers: TextMarker[] = useMemo(() => {
    if (selectedTool !== 'add_text' || !toolOptions.textPlacementSet) return [];
    const opts = toolOptions.textOptions;
    if (!opts.text.trim()) return [];
    return [{
      page: opts.page,
      x: opts.x,
      y: opts.y,
      text: opts.text,
      color: opts.color,
    }];
  }, [selectedTool, toolOptions.textOptions, toolOptions.textPlacementSet]);

  const signatureMarker: SignatureMarker | null = useMemo(() => {
    if (selectedTool !== 'sign' || !toolOptions.signPlacementSet) return null;
    const opts = toolOptions.signOptions;
    return {
      page: opts.page,
      x: opts.x,
      y: opts.y,
      width: opts.width,
      height: opts.height,
    };
  }, [selectedTool, toolOptions.signOptions, toolOptions.signPlacementSet]);

  const redactRegions = useMemo(() => {
    if (selectedTool !== 'redact') return [];
    return toolOptions.redactOptions.regions;
  }, [selectedTool, toolOptions.redactOptions.regions]);

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
  const showBottomPanel = selectedTool && !jobId;
  const showJobOverlay = isUploading || jobId || uploadError;
  const mergeNeedsMore = selectedTool === 'merge' && files.length > 0 && files.length < 2;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Desktop sidebar - compact icon-only */}
      <aside className="hidden lg:flex flex-col border-r bg-background w-14 shrink-0">
        <div className="flex items-center justify-center px-1 py-2 border-b">
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
            Tools
          </span>
        </div>
        <ToolSidebar
          selectedTool={selectedTool}
          onSelectTool={handleToolSelect}
          className="flex-1 overflow-hidden"
          compact
        />
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile tool bar */}
        <div className="lg:hidden border-b bg-background">
          <ToolBarMobile selectedTool={selectedTool} onSelectTool={handleToolSelect} />
        </div>

        {/* Viewer toolbar (when we have a file) */}
        {primaryFile && (
          <ViewerToolbar
            fileName={primaryFile.name}
            fileSize={primaryFile.size}
            currentPage={currentPage}
            totalPages={totalPages}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        )}

        {/* Content area */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          {/* PDF Viewer / File preview area */}
          {!primaryFile ? (
            /* No file: show dropzone */
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-lg">
                <FileDropzone
                  files={files}
                  onFilesChange={setFiles}
                  multiple={isMultiple}
                  disabled={isUploading || !!jobId}
                  mode="default"
                  acceptedExtensions={acceptedExtensions}
                  hint={
                    selectedTool && nonPdfInputOps[selectedTool]
                      ? `Accepted formats: ${nonPdfInputOps[selectedTool]!.join(', ')}`
                      : undefined
                  }
                />
                {!selectedTool && (
                  <div className="mt-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Upload a file, then pick a tool from the sidebar.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : canPreviewPdf ? (
            /* PDF file: show PDF viewer */
            <div className="flex-1 overflow-hidden relative">
              <PdfViewer
                file={primaryFile}
                zoom={zoom}
                onZoomChange={setZoom}
                onPageCountChange={setTotalPages}
                onCurrentPageChange={setCurrentPage}
                className="h-full"
                interactionMode={interactionMode}
                textMarkers={textMarkers}
                redactRegions={redactRegions}
                signatureMarker={signatureMarker}
              />

              {/* Multi-file indicator for merge */}
              {isMultiple && files.length > 1 && (
                <div className="absolute top-3 left-3 bg-background/90 backdrop-blur border rounded-lg px-3 py-2 shadow-sm">
                  <p className="text-xs font-medium">{files.length} files selected</p>
                  <p className="text-xs text-muted-foreground">Previewing first file</p>
                </div>
              )}

              {/* File change overlay button */}
              <div className="absolute top-3 right-3 flex gap-2">
                {isMultiple && (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept={acceptedExtensions?.join(',') || '.pdf'}
                      onChange={(e) => {
                        if (e.target.files) {
                          setFiles([...files, ...Array.from(e.target.files)]);
                        }
                        e.target.value = '';
                      }}
                    />
                    <div className="bg-background/90 backdrop-blur border rounded-md px-2.5 py-1.5 shadow-sm hover:bg-accent transition-colors flex items-center gap-1.5 text-xs font-medium">
                      <Upload className="h-3 w-3" />
                      Add files
                    </div>
                  </label>
                )}
              </div>
            </div>
          ) : (
            /* Non-PDF file: show file icon card */
            <div className="flex-1 flex items-center justify-center p-6 bg-muted/30">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="rounded-2xl bg-primary/10 p-6">
                  <FileIcon className="h-16 w-16 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{primaryFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatBytes(primaryFile.size)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Preview is not available for this file type. Select a tool and process it.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFiles([])}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove file
                </Button>
              </div>
            </div>
          )}

          {/* Job progress overlay */}
          {showJobOverlay && (
            <div className="absolute inset-x-0 bottom-0 z-20 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pt-12">
              <div className="max-w-xl mx-auto">
                <JobProgress
                  uploadProgress={uploadProgress}
                  isUploading={isUploading}
                  jobId={jobId}
                  onReset={handleReset}
                  uploadError={uploadError}
                />
                {/* Post-completion actions */}
                {jobId && (
                  <div className="flex items-center justify-center gap-3 pt-3">
                    <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                      <Zap className="h-3.5 w-3.5" />
                      Apply another tool
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleFullReset} className="gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      New file
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tool not selected prompt - subtle banner */}
        {files.length > 0 && !selectedTool && !showJobOverlay && (
          <div className="border-t bg-primary/5 px-4 py-3 flex items-center justify-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Select a tool from the sidebar to get started</span>
          </div>
        )}

        {/* Bottom panel for tool options */}
        {showBottomPanel && (
          <BottomPanel
            tool={selectedTool}
            toolOptions={toolOptions}
            onToolOptionsChange={setToolOptions}
            onProcess={handleProcess}
            onClose={handleToolDeselect}
            canProcess={canProcess}
            isUploading={isUploading}
            hasFiles={files.length > 0}
            mergeNeedsMore={mergeNeedsMore}
          />
        )}
      </div>
    </div>
  );
}
