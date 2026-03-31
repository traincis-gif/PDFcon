'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// We dynamically import pdfjs-dist so Next.js SSR doesn't choke on it
let pdfjsLib: typeof import('pdfjs-dist') | null = null;
let pdfjsLoaded = false;

type PDFDocumentProxy = Awaited<ReturnType<typeof import('pdfjs-dist')['getDocument']>>['promise'] extends Promise<infer T> ? T : never;

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const FIT_WIDTH = -1;

interface PageInfo {
  width: number;
  height: number;
  rendered: boolean;
  rendering: boolean;
}

interface PdfViewerProps {
  file: File;
  className?: string;
  onPageCountChange?: (count: number) => void;
  onCurrentPageChange?: (page: number) => void;
  zoom: number; // -1 = fit width, otherwise scale factor
  onZoomChange?: (zoom: number) => void;
}

export { ZOOM_LEVELS, FIT_WIDTH };

export function PdfViewer({
  file,
  className,
  onPageCountChange,
  onCurrentPageChange,
  zoom,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageInfos, setPageInfos] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderingPages = useRef<Set<number>>(new Set());
  const renderedAtScale = useRef<Map<number, number>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pageElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  // Load pdfjs-dist dynamically
  useEffect(() => {
    let cancelled = false;
    async function loadPdfJs() {
      if (!pdfjsLoaded) {
        const lib = await import('pdfjs-dist');
        const pdfjsVersion = lib.version;
        lib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`;
        pdfjsLib = lib;
        pdfjsLoaded = true;
      }
      if (!cancelled) {
        loadPdf();
      }
    }

    async function loadPdf() {
      if (!pdfjsLib) return;
      setLoading(true);
      setError(null);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(doc);
        setPageCount(doc.numPages);
        onPageCountChange?.(doc.numPages);

        // Get page dimensions for layout
        const infos: PageInfo[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          infos.push({
            width: viewport.width,
            height: viewport.height,
            rendered: false,
            rendering: false,
          });
        }
        if (!cancelled) {
          setPageInfos(infos);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load PDF');
          setLoading(false);
        }
      }
    }

    loadPdfJs();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Track container width for fit-width mode
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    resizeObserver.observe(container);
    setContainerWidth(container.clientWidth);
    return () => resizeObserver.disconnect();
  }, []);

  // Compute effective scale
  const getEffectiveScale = useCallback(
    (pageIndex: number) => {
      if (zoom !== FIT_WIDTH || !pageInfos[pageIndex] || containerWidth === 0) {
        return zoom === FIT_WIDTH ? 1 : zoom;
      }
      const pageWidth = pageInfos[pageIndex].width;
      const padding = 48; // 24px each side
      const available = containerWidth - padding;
      return Math.min(available / pageWidth, 3);
    },
    [zoom, pageInfos, containerWidth]
  );

  // Render a specific page to canvas
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || renderingPages.current.has(pageNum)) return;
      const pageIndex = pageNum - 1;
      const scale = getEffectiveScale(pageIndex);
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

      // Skip if already rendered at this scale
      if (renderedAtScale.current.get(pageNum) === scale) return;

      renderingPages.current.add(pageNum);

      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: scale * dpr });
        const displayViewport = page.getViewport({ scale });

        const canvas = canvasRefs.current.get(pageNum);
        if (!canvas) {
          renderingPages.current.delete(pageNum);
          return;
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${displayViewport.width}px`;
        canvas.style.height = `${displayViewport.height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          renderingPages.current.delete(pageNum);
          return;
        }

        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;

        renderedAtScale.current.set(pageNum, scale);
        renderingPages.current.delete(pageNum);

        setPageInfos((prev) => {
          const next = [...prev];
          if (next[pageIndex]) {
            next[pageIndex] = { ...next[pageIndex], rendered: true, rendering: false };
          }
          return next;
        });
      } catch {
        renderingPages.current.delete(pageNum);
      }
    },
    [pdfDoc, getEffectiveScale]
  );

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!pdfDoc || pageCount === 0) return;

    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(
              (entry.target as HTMLElement).dataset.page || '0',
              10
            );
            if (pageNum > 0) {
              renderPage(pageNum);
              // Pre-render adjacent pages
              if (pageNum > 1) renderPage(pageNum - 1);
              if (pageNum < pageCount) renderPage(pageNum + 1);
            }
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: '200px 0px',
        threshold: 0.01,
      }
    );

    observerRef.current = observer;

    // Observe all page elements
    pageElementsRef.current.forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [pdfDoc, pageCount, renderPage]);

  // Re-render visible pages when zoom changes
  useEffect(() => {
    if (!pdfDoc || pageCount === 0) return;
    // Clear rendered cache to force re-render at new scale
    renderedAtScale.current.clear();

    // Re-render pages that are currently in view
    pageElementsRef.current.forEach((el, pageNum) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const isVisible =
        rect.bottom > containerRect.top && rect.top < containerRect.bottom;
      if (isVisible) {
        renderPage(pageNum);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, containerWidth, pdfDoc, pageCount]);

  // Track current page from scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container || pageCount === 0) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const containerMid = containerRect.top + containerRect.height / 2;

      let closestPage = 1;
      let closestDist = Infinity;

      pageElementsRef.current.forEach((el, pageNum) => {
        const rect = el.getBoundingClientRect();
        const pageMid = rect.top + rect.height / 2;
        const dist = Math.abs(pageMid - containerMid);
        if (dist < closestDist) {
          closestDist = dist;
          closestPage = pageNum;
        }
      });

      onCurrentPageChange?.(closestPage);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    // Fire once on mount
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [pageCount, onCurrentPageChange]);

  // Register a page element ref
  const setPageRef = useCallback(
    (pageNum: number) => (el: HTMLDivElement | null) => {
      if (el) {
        pageElementsRef.current.set(pageNum, el);
        observerRef.current?.observe(el);
      } else {
        pageElementsRef.current.delete(pageNum);
      }
    },
    []
  );

  // Register a canvas ref
  const setCanvasRef = useCallback(
    (pageNum: number) => (el: HTMLCanvasElement | null) => {
      if (el) {
        canvasRefs.current.set(pageNum, el);
      } else {
        canvasRefs.current.delete(pageNum);
      }
    },
    []
  );

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div className="rounded-full bg-destructive/10 p-3">
            <svg
              className="h-6 w-6 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-destructive">Failed to load PDF</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto h-full bg-muted/30', className)}
    >
      <div className="flex flex-col items-center py-4 gap-4">
        {Array.from({ length: pageCount }, (_, i) => {
          const pageNum = i + 1;
          const info = pageInfos[i];
          const scale = getEffectiveScale(i);
          const displayWidth = info ? info.width * scale : 600;
          const displayHeight = info ? info.height * scale : 800;

          return (
            <div
              key={pageNum}
              ref={setPageRef(pageNum)}
              data-page={pageNum}
              className="relative bg-white shadow-md rounded-sm"
              style={{
                width: `${displayWidth}px`,
                height: `${displayHeight}px`,
                minHeight: `${displayHeight}px`,
              }}
            >
              <canvas
                ref={setCanvasRef(pageNum)}
                className="block"
              />
              {/* Page number badge */}
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
                {pageNum}
              </div>
              {/* Loading skeleton overlay */}
              {!info?.rendered && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Rendering page {pageNum}...
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
