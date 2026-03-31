'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { FileDropzone } from '@/components/file-dropzone';
import { PdfViewer, FIT_WIDTH } from '@/components/pdf-viewer';
import type { InteractionMode, TextMarker, SignatureMarker } from '@/components/pdf-viewer';
import { ViewerToolbar } from '@/components/viewer-toolbar';
import { HorizontalToolbar } from '@/components/horizontal-toolbar';
import { FloatingToolPanel } from '@/components/floating-tool-panel';
import { TextPlacementPopup } from '@/components/text-placement-popup';
import { ImagePreview } from '@/components/image-preview';
import { detectFileType, toolsForFileType, getDefaultTool } from '@/lib/file-types';
import type { FileCategory } from '@/lib/file-types';
import {
  buildMetadata,
  validateOptions,
  defaultToolOptionsState,
  isInteractiveTool,
  getInteractionInstruction,
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
  FileIcon,
  Upload,
  FileSpreadsheet,
  Presentation,
  ImageIcon,
  Crosshair,
  RotateCcw,
} from 'lucide-react';
import type { OperationType } from '@/types';

/** Operations that accept multiple files */
const multiFileOps = new Set<OperationType>(['merge', 'img_to_pdf']);

/** Operations whose output is NOT a PDF (so we can't preview result) */
const nonPdfOutputOps = new Set<OperationType>([
  'convert_to_png',
  'convert_to_jpg',
  'convert_to_txt',
  'convert_to_docx',
  'convert_to_xlsx',
  'convert_to_pptx',
]);

/** Tools that have no options and process immediately */
const immediateTools = new Set<OperationType>([
  'compress',
  'split',
  'flatten',
  'convert_to_png',
  'convert_to_jpg',
  'convert_to_txt',
  'convert_to_docx',
  'convert_to_xlsx',
  'convert_to_pptx',
  'docx_to_pdf',
  'xlsx_to_pdf',
  'pptx_to_pdf',
  'img_to_pdf',
  'ocr',
  'merge',
]);

/** Tools that show the floating panel for options */
const panelTools = new Set<OperationType>([
  'watermark',
  'rotate',
  'reorder',
  'encrypt',
  'page_numbers',
]);

/** Check if file is a PDF */
function isPdfFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
}

/** Get icon for file category */
function getCategoryIcon(category: FileCategory): React.ElementType {
  switch (category) {
    case 'word':
      return FileText;
    case 'excel':
      return FileSpreadsheet;
    case 'powerpoint':
      return Presentation;
    case 'image':
      return ImageIcon;
    default:
      return FileIcon;
  }
}

/** Get category display label */
function getCategoryLabel(category: FileCategory): string {
  switch (category) {
    case 'word':
      return 'Word Document';
    case 'excel':
      return 'Excel Spreadsheet';
    case 'powerpoint':
      return 'PowerPoint Presentation';
    case 'image':
      return 'Image File';
    default:
      return 'PDF Document';
  }
}

interface PdfEditorProps {
  initialFiles?: File[];
  onStartOver?: () => void;
}

/** Multi-text marker for adding multiple text annotations */
interface PlacedText {
  page: number;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
}

export function PdfEditor({ initialFiles, onStartOver }: PdfEditorProps) {
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

  // Text placement popup state
  const [textPopup, setTextPopup] = useState<{
    screenX: number;
    screenY: number;
    page: number;
    pdfX: number;
    pdfY: number;
  } | null>(null);

  // Multi-text markers: accumulate placed texts
  const [placedTexts, setPlacedTexts] = useState<PlacedText[]>([]);

  const primaryFile = files[0] || null;
  const fileCategory: FileCategory = primaryFile ? detectFileType(primaryFile) : 'pdf';
  const canPreviewPdf = primaryFile && isPdfFile(primaryFile);
  const isMultiple = selectedTool !== null && multiFileOps.has(selectedTool);

  // Auto-select tool for non-PDF files
  const effectiveSelectedTool = useMemo(() => {
    if (selectedTool) return selectedTool;
    if (primaryFile && fileCategory !== 'pdf') {
      return getDefaultTool(fileCategory);
    }
    return null;
  }, [selectedTool, primaryFile, fileCategory]);

  const handleToolSelect = useCallback(
    (tool: OperationType) => {
      setSelectedTool(tool);
      setJobId(null);
      setUploadError(null);
      setUploadProgress(0);
      setIsUploading(false);
      setTextPopup(null);
      setPlacedTexts([]);

      // If switching away from multi-file op, trim to one file
      if (!multiFileOps.has(tool) && files.length > 1) {
        setFiles(files.slice(0, 1));
      }
    },
    [files]
  );

  const handleToolDeselect = useCallback(() => {
    setSelectedTool(null);
    setJobId(null);
    setUploadError(null);
    setUploadProgress(0);
    setIsUploading(false);
    setTextPopup(null);
    setPlacedTexts([]);
  }, []);

  // Interactive viewer callbacks - extended with screen coordinates
  const handleTextPlacement = useCallback(
    (page: number, x: number, y: number, screenX: number, screenY: number) => {
      // Show popup for text input at click position
      setTextPopup({ screenX, screenY, page, pdfX: x, pdfY: y });
    },
    []
  );

  const handleTextPopupAdd = useCallback(
    (text: string, fontSize: number, color: string) => {
      if (!textPopup) return;
      const newText: PlacedText = {
        page: textPopup.page,
        x: textPopup.pdfX,
        y: textPopup.pdfY,
        text,
        fontSize,
        color,
      };
      setPlacedTexts((prev) => [...prev, newText]);

      // Also update toolOptions for the first placed text (for metadata building)
      setToolOptions((prev) => ({
        ...prev,
        textOptions: {
          ...prev.textOptions,
          text,
          page: textPopup.page,
          x: textPopup.pdfX,
          y: textPopup.pdfY,
          fontSize,
          color,
        },
        textPlacementSet: true,
      }));

      setTextPopup(null);
    },
    [textPopup]
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
    (page: number, x: number, y: number, _screenX: number, _screenY: number) => {
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
    if (!effectiveSelectedTool || !canPreviewPdf || jobId) return { type: 'none' };

    switch (effectiveSelectedTool) {
      case 'add_text':
        return { type: 'click', onPageClick: handleTextPlacement };
      case 'redact':
        return { type: 'draw-rect', onRectDrawn: handleRedactRectDrawn };
      case 'sign':
        return { type: 'click', onPageClick: handleSignPlacement };
      default:
        return { type: 'none' };
    }
  }, [effectiveSelectedTool, canPreviewPdf, jobId, handleTextPlacement, handleRedactRectDrawn, handleSignPlacement]);

  // Build overlay markers for the viewer - use placedTexts for multi-text support
  const textMarkers: TextMarker[] = useMemo(() => {
    if (effectiveSelectedTool !== 'add_text') return [];
    return placedTexts.map((pt) => ({
      page: pt.page,
      x: pt.x,
      y: pt.y,
      text: pt.text,
      color: pt.color,
    }));
  }, [effectiveSelectedTool, placedTexts]);

  const signatureMarker: SignatureMarker | null = useMemo(() => {
    if (effectiveSelectedTool !== 'sign' || !toolOptions.signPlacementSet) return null;
    const opts = toolOptions.signOptions;
    return {
      page: opts.page,
      x: opts.x,
      y: opts.y,
      width: opts.width,
      height: opts.height,
    };
  }, [effectiveSelectedTool, toolOptions.signOptions, toolOptions.signPlacementSet]);

  const redactRegions = useMemo(() => {
    if (effectiveSelectedTool !== 'redact') return [];
    return toolOptions.redactOptions.regions;
  }, [effectiveSelectedTool, toolOptions.redactOptions.regions]);

  const canProcess = (() => {
    if (files.length === 0 || !effectiveSelectedTool || isUploading || jobId) return false;
    if (effectiveSelectedTool === 'merge' && files.length < 2) return false;

    // For add_text with multi-text, check placedTexts
    if (effectiveSelectedTool === 'add_text') {
      return placedTexts.length > 0;
    }

    return validateOptions(effectiveSelectedTool, toolOptions);
  })();

  const handleProcess = async () => {
    if (!effectiveSelectedTool) return;

    // For immediate tools with files, just go
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setJobId(null);

    try {
      const metadata = buildMetadata(effectiveSelectedTool, toolOptions);
      const res = await api.uploadAndProcess(files, effectiveSelectedTool, (pct) => {
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

  // For immediate tools: process as soon as tool is selected (when files present)
  const handleImmediateToolSelect = useCallback(
    (tool: OperationType) => {
      handleToolSelect(tool);

      // If it's an immediate tool and we have files, start processing after state updates
      if (immediateTools.has(tool) && files.length > 0 && !isUploading && !jobId) {
        // Use a short timeout to let state settle
        setTimeout(() => {
          // Process will be triggered by the effect below
        }, 0);
      }
    },
    [handleToolSelect, files, isUploading, jobId]
  );

  const handleReset = () => {
    setJobId(null);
    setUploadError(null);
    setUploadProgress(0);
    setIsUploading(false);
    setTextPopup(null);
    setPlacedTexts([]);
  };

  const handleFullReset = () => {
    handleReset();
    setFiles([]);
    setSelectedTool(null);
    setToolOptions(defaultToolOptionsState);
    if (onStartOver) onStartOver();
  };

  const showJobOverlay = isUploading || jobId || uploadError;
  const showFloatingPanel =
    effectiveSelectedTool &&
    panelTools.has(effectiveSelectedTool) &&
    !jobId &&
    files.length > 0;

  // Determine whether to show the interaction instruction banner
  const showInteractionBanner =
    effectiveSelectedTool &&
    isInteractiveTool(effectiveSelectedTool) &&
    canPreviewPdf &&
    !jobId &&
    !textPopup;

  // For sign tool: show floating panel for signature options alongside interaction
  const showSignPanel =
    effectiveSelectedTool === 'sign' && !jobId && files.length > 0;

  // For redact tool: show "Apply" button when regions exist
  const showRedactApply =
    effectiveSelectedTool === 'redact' &&
    toolOptions.redactOptions.regions.length > 0 &&
    !jobId;

  // For add_text with placedTexts: show "Done" button
  const showTextDone =
    effectiveSelectedTool === 'add_text' &&
    placedTexts.length > 0 &&
    !jobId;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
      {/* Horizontal toolbar - replaces sidebar */}
      {primaryFile && !showJobOverlay && (
        <HorizontalToolbar
          fileCategory={fileCategory}
          selectedTool={effectiveSelectedTool}
          onSelectTool={handleImmediateToolSelect}
        />
      )}

      {/* Viewer toolbar (when we have a PDF file) */}
      {primaryFile && canPreviewPdf && (
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
        {!primaryFile ? (
          /* No file: show dropzone in editor */
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-lg">
              <FileDropzone
                files={files}
                onFilesChange={setFiles}
                multiple={false}
                disabled={isUploading || !!jobId}
                mode="default"
              />
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
              <div className="absolute top-3 left-3 bg-background/90 backdrop-blur border rounded-lg px-3 py-2 shadow-sm z-20">
                <p className="text-xs font-medium">{files.length} files selected</p>
                <p className="text-xs text-muted-foreground">Previewing first file</p>
              </div>
            )}

            {/* Interaction instruction banner */}
            {showInteractionBanner && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
                <div className="flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-2 shadow-lg text-sm font-medium">
                  <Crosshair className="h-4 w-4 animate-pulse" />
                  <span>{getInteractionInstruction(effectiveSelectedTool as any)}</span>
                </div>
              </div>
            )}

            {/* Text placement popup */}
            {textPopup && (
              <TextPlacementPopup
                screenX={textPopup.screenX}
                screenY={textPopup.screenY}
                onAdd={handleTextPopupAdd}
                onClose={() => setTextPopup(null)}
              />
            )}

            {/* Floating tool panel for non-interactive tools with options */}
            {showFloatingPanel && (
              <FloatingToolPanel
                tool={effectiveSelectedTool!}
                toolOptions={toolOptions}
                onToolOptionsChange={setToolOptions}
                onProcess={handleProcess}
                onClose={handleToolDeselect}
                canProcess={canProcess}
                isUploading={isUploading}
              />
            )}

            {/* Sign tool: floating panel for signature options */}
            {showSignPanel && !showFloatingPanel && (
              <FloatingToolPanel
                tool="sign"
                toolOptions={toolOptions}
                onToolOptionsChange={setToolOptions}
                onProcess={handleProcess}
                onClose={handleToolDeselect}
                canProcess={canProcess}
                isUploading={isUploading}
              />
            )}

            {/* Redact: "Apply Redactions" button */}
            {showRedactApply && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleProcess}
                    disabled={!canProcess}
                    className="gap-2 shadow-lg"
                  >
                    <Zap className="h-4 w-4" />
                    Apply Redactions ({toolOptions.redactOptions.regions.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToolDeselect}
                    className="shadow-lg bg-background"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Add Text: "Done" button when texts are placed */}
            {showTextDone && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleProcess}
                    disabled={!canProcess}
                    className="gap-2 shadow-lg"
                  >
                    <Zap className="h-4 w-4" />
                    Done - Add {placedTexts.length} Text{placedTexts.length > 1 ? 's' : ''}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPlacedTexts([]);
                      setToolOptions((prev) => ({ ...prev, textPlacementSet: false }));
                    }}
                    className="shadow-lg bg-background"
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            )}

            {/* File change overlay button */}
            <div className="absolute top-3 right-3 flex gap-2 z-20">
              {isMultiple && (
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept=".pdf"
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

            {/* Immediate tool: process button for tools like compress, split, flatten */}
            {effectiveSelectedTool &&
              immediateTools.has(effectiveSelectedTool) &&
              !jobId &&
              !isUploading &&
              !showJobOverlay &&
              fileCategory === 'pdf' && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
                  <Button
                    onClick={handleProcess}
                    disabled={!canProcess}
                    size="lg"
                    className="gap-2 shadow-lg"
                  >
                    <Zap className="h-4 w-4" />
                    {operationLabel(effectiveSelectedTool)}
                  </Button>
                </div>
              )}
          </div>
        ) : fileCategory === 'image' ? (
          /* Image file: show image preview */
          <div className="flex-1 overflow-hidden relative">
            <ImagePreview file={primaryFile} className="h-full" />

            {/* Big action button for image */}
            {effectiveSelectedTool && !jobId && !isUploading && !showJobOverlay && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
                <Button
                  onClick={handleProcess}
                  size="lg"
                  className="gap-2 shadow-xl text-base px-8 py-6"
                >
                  <Zap className="h-5 w-5" />
                  {operationLabel(effectiveSelectedTool)}
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Word/Excel/PPT: styled card with icon + convert button */
          <div className="flex-1 flex items-center justify-center p-6 bg-muted/30">
            <div className="flex flex-col items-center gap-6 text-center max-w-sm">
              {(() => {
                const CategoryIcon = getCategoryIcon(fileCategory);
                return (
                  <div className="rounded-2xl bg-primary/10 p-8">
                    <CategoryIcon className="h-20 w-20 text-primary" />
                  </div>
                );
              })()}
              <div>
                <p className="text-lg font-semibold">{primaryFile.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {getCategoryLabel(fileCategory)} -- {formatBytes(primaryFile.size)}
                </p>
              </div>

              {/* Big convert button */}
              {effectiveSelectedTool && !jobId && !isUploading && !showJobOverlay && (
                <Button
                  onClick={handleProcess}
                  size="lg"
                  className="gap-2.5 text-base px-8 py-6 shadow-lg"
                >
                  <Zap className="h-5 w-5" />
                  Convert to PDF
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiles([])}
                className="gap-1.5 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Choose a different file
              </Button>
            </div>
          </div>
        )}

        {/* Job progress overlay */}
        {showJobOverlay && (
          <div className="absolute inset-x-0 bottom-0 z-40 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pt-12">
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
                    <RotateCcw className="h-3.5 w-3.5" />
                    Start over
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
