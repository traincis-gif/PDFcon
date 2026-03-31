'use client';

import React from 'react';
import { cn, formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
} from 'lucide-react';
import { ZOOM_LEVELS, FIT_WIDTH } from './pdf-viewer';

interface ViewerToolbarProps {
  fileName: string;
  fileSize: number;
  currentPage: number;
  totalPages: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  className?: string;
}

export function ViewerToolbar({
  fileName,
  fileSize,
  currentPage,
  totalPages,
  zoom,
  onZoomChange,
  className,
}: ViewerToolbarProps) {
  const displayZoom = zoom === FIT_WIDTH ? 'Fit' : `${Math.round(zoom * 100)}%`;

  const zoomIn = () => {
    if (zoom === FIT_WIDTH) {
      onZoomChange(ZOOM_LEVELS[2]); // 100%
      return;
    }
    const idx = ZOOM_LEVELS.findIndex((z) => z > zoom);
    if (idx !== -1) {
      onZoomChange(ZOOM_LEVELS[idx]);
    }
  };

  const zoomOut = () => {
    if (zoom === FIT_WIDTH) {
      onZoomChange(ZOOM_LEVELS[1]); // 75%
      return;
    }
    const idx = ZOOM_LEVELS.findLastIndex((z) => z < zoom);
    if (idx !== -1) {
      onZoomChange(ZOOM_LEVELS[idx]);
    }
  };

  const fitWidth = () => {
    onZoomChange(FIT_WIDTH);
  };

  return (
    <div
      className={cn(
        'flex items-center h-10 px-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 gap-2',
        className
      )}
    >
      {/* Left: filename */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink">
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate max-w-[200px]">{fileName}</span>
        <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
          {formatBytes(fileSize)}
        </span>
      </div>

      {/* Center: page indicator */}
      <div className="flex-1 flex justify-center">
        {totalPages > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums bg-muted px-2.5 py-1 rounded-md">
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      {/* Right: zoom controls */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={zoomOut}
          title="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <button
          onClick={fitWidth}
          className="text-xs tabular-nums text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded transition-colors min-w-[40px] text-center"
          title="Fit width"
        >
          {displayZoom}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={zoomIn}
          title="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hidden sm:inline-flex"
          onClick={fitWidth}
          title="Fit width"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
