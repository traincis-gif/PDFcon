'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImagePreviewProps {
  file: File;
  className?: string;
}

export function ImagePreview({ file, className }: ImagePreviewProps) {
  const [zoom, setZoom] = useState(1);

  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);

  // Clean up object URL on unmount or file change
  useEffect(() => {
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  const zoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));
  const resetZoom = () => setZoom(1);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Zoom controls */}
      <div className="flex items-center justify-center gap-1 py-2 border-b bg-background/95 backdrop-blur shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} title="Zoom out">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <button
          onClick={resetZoom}
          className="text-xs tabular-nums text-muted-foreground hover:text-foreground px-2 py-0.5 rounded transition-colors min-w-[44px] text-center"
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} title="Zoom in">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetZoom} title="Reset">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Image display area */}
      <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-6">
        <img
          src={objectUrl}
          alt={file.name}
          className="max-w-full rounded shadow-md transition-transform duration-150"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
