'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import type { RedactRegion } from '@/components/redact-options';
import type { TextEdit } from '@/types';
import { TextLayer } from '@/components/text-layer';

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

export type InteractionMode =
  | { type: 'none' }
  | { type: 'click'; onPageClick: (page: number, x: number, y: number, screenX: number, screenY: number) => void }
  | { type: 'draw-rect'; onRectDrawn: (page: number, x: number, y: number, width: number, height: number) => void };

export interface TextMarker {
  page: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

export interface SignatureMarker {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfViewerProps {
  file: File;
  className?: string;
  onPageCountChange?: (count: number) => void;
  onCurrentPageChange?: (page: number) => void;
  zoom: number; // -1 = fit width, otherwise scale factor
  onZoomChange?: (zoom: number) => void;
  interactionMode?: InteractionMode;
  textMarkers?: TextMarker[];
  redactRegions?: RedactRegion[];
  signatureMarker?: SignatureMarker | null;
  editableText?: boolean;
  onTextEdited?: (edit: TextEdit) => void;
  textEdits?: TextEdit[];
}

export { ZOOM_LEVELS, FIT_WIDTH };

export function PdfViewer({
  file,
  className,
  onPageCountChange,
  onCurrentPageChange,
  zoom,
  interactionMode = { type: 'none' },
  textMarkers = [],
  redactRegions = [],
  signatureMarker = null,
  editableText = false,
  onTextEdited,
  textEdits = [],
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

  // Drawing state for draw-rect mode
  const [drawState, setDrawState] = useState<{
    active: boolean;
    page: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Long-press state for mobile
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Track container width for fit-width mode (with ResizeObserver fallback)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(container);
      setContainerWidth(container.clientWidth);
      return () => resizeObserver.disconnect();
    } else {
      // Fallback: listen for window resize events
      const handleResize = () => {
        if (container) setContainerWidth(container.clientWidth);
      };
      setContainerWidth(container.clientWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
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

        // Safari: use willReadFrequently hint for better canvas performance
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
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

  // Intersection Observer for lazy loading (with fallback)
  useEffect(() => {
    if (!pdfDoc || pageCount === 0) return;

    observerRef.current?.disconnect();

    if (typeof IntersectionObserver !== 'undefined') {
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
    } else {
      // Fallback: render all pages eagerly when IntersectionObserver is unavailable
      for (let i = 1; i <= pageCount; i++) {
        renderPage(i);
      }
    }
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

  // Convert mouse event coordinates to PDF coordinate space
  const convertToPdfCoords = useCallback(
    (event: React.MouseEvent | React.Touch, overlayEl: HTMLElement, pageIndex: number) => {
      const rect = overlayEl.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;
      const scale = getEffectiveScale(pageIndex);
      const pageHeight = pageInfos[pageIndex]?.height || 0;

      const pdfX = canvasX / scale;
      const pdfY = pageHeight - (canvasY / scale);

      return { pdfX, pdfY, canvasX, canvasY };
    },
    [getEffectiveScale, pageInfos]
  );

  // Handle overlay click for click mode
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
      if (interactionMode.type !== 'click') return;
      const pageIndex = pageNum - 1;
      const { pdfX, pdfY } = convertToPdfCoords(event, event.currentTarget, pageIndex);
      interactionMode.onPageClick(
        pageNum,
        Math.round(pdfX * 100) / 100,
        Math.round(pdfY * 100) / 100,
        event.clientX,
        event.clientY
      );
    },
    [interactionMode, convertToPdfCoords]
  );

  // Handle touch for mobile long-press
  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>, pageNum: number) => {
      if (interactionMode.type === 'none') return;
      const touch = event.touches[0];
      const target = event.currentTarget;
      const pageIndex = pageNum - 1;

      longPressTimer.current = setTimeout(() => {
        if (interactionMode.type === 'click') {
          const rect = target.getBoundingClientRect();
          const canvasX = touch.clientX - rect.left;
          const canvasY = touch.clientY - rect.top;
          const scale = getEffectiveScale(pageIndex);
          const pageHeight = pageInfos[pageIndex]?.height || 0;
          const pdfX = canvasX / scale;
          const pdfY = pageHeight - (canvasY / scale);
          interactionMode.onPageClick(pageNum, Math.round(pdfX * 100) / 100, Math.round(pdfY * 100) / 100, touch.clientX, touch.clientY);
        }
        longPressTimer.current = null;
      }, 500);
    },
    [interactionMode, getEffectiveScale, pageInfos]
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Handle draw-rect mode mouse events
  const handleOverlayMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
      if (interactionMode.type !== 'draw-rect') return;
      event.preventDefault();
      const pageIndex = pageNum - 1;
      const rect = event.currentTarget.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;

      setDrawState({
        active: true,
        page: pageNum,
        startX: canvasX,
        startY: canvasY,
        currentX: canvasX,
        currentY: canvasY,
      });
    },
    [interactionMode]
  );

  const handleOverlayMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!drawState?.active) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;
      setDrawState((prev) => prev ? { ...prev, currentX: canvasX, currentY: canvasY } : null);
    },
    [drawState?.active]
  );

  const handleOverlayMouseUp = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!drawState?.active || interactionMode.type !== 'draw-rect') return;
      const pageIndex = drawState.page - 1;
      const scale = getEffectiveScale(pageIndex);
      const pageHeight = pageInfos[pageIndex]?.height || 0;

      const x1 = Math.min(drawState.startX, drawState.currentX) / scale;
      const y1 = Math.min(drawState.startY, drawState.currentY) / scale;
      const x2 = Math.max(drawState.startX, drawState.currentX) / scale;
      const y2 = Math.max(drawState.startY, drawState.currentY) / scale;

      const width = x2 - x1;
      const height = y2 - y1;

      // Only register if the rectangle is big enough (at least 5 PDF points)
      if (width > 5 && height > 5) {
        // Convert to PDF coords (origin bottom-left)
        const pdfX = x1;
        const pdfY = pageHeight - y2;
        interactionMode.onRectDrawn(
          drawState.page,
          Math.round(pdfX * 100) / 100,
          Math.round(pdfY * 100) / 100,
          Math.round(width * 100) / 100,
          Math.round(height * 100) / 100
        );
      }

      setDrawState(null);
    },
    [drawState, interactionMode, getEffectiveScale, pageInfos]
  );

  const isInteractive = interactionMode.type !== 'none';

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

          // Get markers/overlays for this page
          const pageTextMarkers = textMarkers.filter((m) => m.page === pageNum);
          const pageRedactRegions = redactRegions.filter((r) => r.page === pageNum);
          const pageSignature = signatureMarker && signatureMarker.page === pageNum ? signatureMarker : null;
          const pageHeight = info?.height || 0;

          // Current drawing rect for this page (in canvas pixels)
          const isDrawingOnThisPage = drawState?.active && drawState.page === pageNum;

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

              {/* Editable text layer */}
              {editableText && info && onTextEdited && (
                <TextLayer
                  file={file}
                  pageNumber={pageNum}
                  scale={scale}
                  pageHeight={info.height}
                  editable={editableText}
                  onTextEdited={onTextEdited}
                  editedTexts={textEdits.filter((e) => e.page === pageNum - 1)}
                />
              )}

              {/* Interactive overlay layer */}
              {isInteractive && (
                <div
                  className="absolute inset-0 z-10"
                  style={{ cursor: 'crosshair', touchAction: 'none', WebkitTouchCallout: 'none' }}
                  onClick={(e) => handleOverlayClick(e, pageNum)}
                  onMouseDown={(e) => handleOverlayMouseDown(e, pageNum)}
                  onMouseMove={handleOverlayMouseMove}
                  onMouseUp={handleOverlayMouseUp}
                  onMouseLeave={(e) => {
                    if (drawState?.active) handleOverlayMouseUp(e);
                  }}
                  onTouchStart={(e) => handleTouchStart(e, pageNum)}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                />
              )}

              {/* Overlay SVG for markers and rectangles */}
              <svg
                className="absolute inset-0 z-[5] pointer-events-none"
                width={displayWidth}
                height={displayHeight}
                viewBox={`0 0 ${displayWidth} ${displayHeight}`}
              >
                {/* Drawing rectangle preview */}
                {isDrawingOnThisPage && drawState && (
                  <rect
                    x={Math.min(drawState.startX, drawState.currentX)}
                    y={Math.min(drawState.startY, drawState.currentY)}
                    width={Math.abs(drawState.currentX - drawState.startX)}
                    height={Math.abs(drawState.currentY - drawState.startY)}
                    fill="rgba(220, 38, 38, 0.2)"
                    stroke="#DC2626"
                    strokeWidth="2"
                    strokeDasharray="6 3"
                  />
                )}

                {/* Redact region overlays */}
                {pageRedactRegions.map((region, idx) => {
                  // Convert PDF coords back to canvas coords
                  const rx = region.x * scale;
                  const ry = (pageHeight - region.y - region.height) * scale;
                  const rw = region.width * scale;
                  const rh = region.height * scale;
                  return (
                    <rect
                      key={`redact-${idx}`}
                      x={rx}
                      y={ry}
                      width={rw}
                      height={rh}
                      fill="rgba(220, 38, 38, 0.25)"
                      stroke="#DC2626"
                      strokeWidth="1.5"
                    />
                  );
                })}

                {/* Text markers */}
                {pageTextMarkers.map((marker, idx) => {
                  const mx = marker.x * scale;
                  const my = (pageHeight - marker.y) * scale;
                  return (
                    <g key={`text-${idx}`}>
                      <circle cx={mx} cy={my} r={6} fill="#2563EB" />
                      <circle cx={mx} cy={my} r={3} fill="white" />
                      <rect
                        x={mx + 10}
                        y={my - 12}
                        width={Math.min(marker.text.length * 7 + 12, 200)}
                        height={24}
                        rx={4}
                        fill="#2563EB"
                        opacity={0.9}
                      />
                      <text
                        x={mx + 16}
                        y={my + 3}
                        fill="white"
                        fontSize="11"
                        fontFamily="system-ui, sans-serif"
                      >
                        {marker.text.length > 25 ? marker.text.slice(0, 25) + '...' : marker.text}
                      </text>
                    </g>
                  );
                })}

                {/* Signature marker */}
                {pageSignature && (
                  <rect
                    x={pageSignature.x * scale}
                    y={(pageHeight - pageSignature.y - pageSignature.height) * scale}
                    width={pageSignature.width * scale}
                    height={pageSignature.height * scale}
                    fill="rgba(37, 99, 235, 0.08)"
                    stroke="#2563EB"
                    strokeWidth="2"
                    strokeDasharray="8 4"
                    rx={4}
                  />
                )}
              </svg>

              {/* Page number badge */}
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none z-20">
                {pageNum}
              </div>
              {/* Loading skeleton overlay */}
              {!info?.rendered && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
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
