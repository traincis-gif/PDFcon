'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Zap, Loader2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageReorderViewProps {
  file: File;
  onApply: (pageOrder: number[]) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

interface PageThumb {
  pageNum: number;
  dataUrl: string;
}

export function PageReorderView({ file, onApply, onCancel, isProcessing }: PageReorderViewProps) {
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate thumbnails from PDF using pdfjs-dist
  useEffect(() => {
    let cancelled = false;

    async function loadThumbnails() {
      setLoading(true);
      try {
        const pdfjsLib = await import('pdfjs-dist');

        // Set worker source
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        const thumbs: PageThumb[] = [];

        for (let i = 1; i <= totalPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.4 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          thumbs.push({ pageNum: i, dataUrl: canvas.toDataURL('image/jpeg', 0.7) });
        }

        if (!cancelled) {
          setPages(thumbs);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load PDF thumbnails:', err);
        if (!cancelled) setLoading(false);
      }
    }

    loadThumbnails();
    return () => { cancelled = true; };
  }, [file]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    // Make the dragged element semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      requestAnimationFrame(() => {
        (e.currentTarget as HTMLElement).style.opacity = '0.4';
      });
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = dragIndex;
    if (sourceIndex === null || sourceIndex === targetIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }

    setPages((prev) => {
      const newPages = [...prev];
      const [moved] = newPages.splice(sourceIndex, 1);
      newPages.splice(targetIndex, 0, moved);
      return newPages;
    });

    setDragIndex(null);
    setOverIndex(null);
  }, [dragIndex]);

  const handleReset = useCallback(() => {
    setPages((prev) => {
      const sorted = [...prev].sort((a, b) => a.pageNum - b.pageNum);
      return sorted;
    });
  }, []);

  const isReordered = pages.some((p, i) => p.pageNum !== i + 1);

  const handleApply = useCallback(() => {
    const order = pages.map((p) => p.pageNum);
    onApply(order);
  }, [pages, onApply]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading page thumbnails...</p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <p className="text-sm text-muted-foreground">No pages found in this PDF.</p>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur shrink-0">
        <div>
          <h3 className="text-sm font-semibold">Reorder Pages</h3>
          <p className="text-xs text-muted-foreground">
            Drag and drop pages to rearrange them ({pages.length} pages)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isReordered && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!isReordered || isProcessing}
            className="gap-1.5"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                Apply
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Page grid */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {pages.map((page, index) => (
            <div
              key={page.pageNum}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              className={cn(
                'relative group cursor-grab active:cursor-grabbing',
                'rounded-lg border-2 bg-card overflow-hidden transition-all duration-150',
                'hover:shadow-md hover:border-primary/30',
                overIndex === index && dragIndex !== index
                  ? 'border-primary shadow-lg scale-[1.02] bg-primary/5'
                  : 'border-border',
                dragIndex === index && 'opacity-40',
              )}
            >
              {/* Drag handle indicator */}
              <div className="absolute top-1 left-1 z-10 opacity-0 group-hover:opacity-60 transition-opacity">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Thumbnail */}
              <div className="aspect-[3/4] bg-muted flex items-center justify-center overflow-hidden">
                <img
                  src={page.dataUrl}
                  alt={`Page ${page.pageNum}`}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>

              {/* Page number badge */}
              <div className="flex items-center justify-center py-1.5 border-t bg-background">
                <span className={cn(
                  'text-xs font-medium tabular-nums',
                  page.pageNum !== index + 1 ? 'text-primary' : 'text-muted-foreground',
                )}>
                  Page {page.pageNum}
                  {page.pageNum !== index + 1 && (
                    <span className="text-muted-foreground ml-1">
                      (was {page.pageNum}, now {index + 1})
                    </span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
