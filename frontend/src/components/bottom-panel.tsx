'use client';

import React, { useEffect, useRef } from 'react';
import { cn, operationLabel } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X, Zap, Loader2 } from 'lucide-react';
import type { OperationType } from '@/types';
import {
  ToolOptions,
  validateOptions,
} from '@/components/tool-options';
import type { ToolOptionsState } from '@/components/tool-options';

interface BottomPanelProps {
  tool: OperationType;
  toolOptions: ToolOptionsState;
  onToolOptionsChange: (options: ToolOptionsState) => void;
  onProcess: () => void;
  onClose: () => void;
  canProcess: boolean;
  isUploading: boolean;
  hasFiles: boolean;
  mergeNeedsMore: boolean;
  className?: string;
}

export function BottomPanel({
  tool,
  toolOptions,
  onToolOptionsChange,
  onProcess,
  onClose,
  canProcess,
  isUploading,
  hasFiles,
  mergeNeedsMore,
  className,
}: BottomPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap: close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className={cn(
        'border-t bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.08)]',
        'animate-in slide-in-from-bottom duration-300 ease-out',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{operationLabel(tool)}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="px-4 py-3 max-h-[40vh] lg:max-h-[35vh] overflow-y-auto">
        <ToolOptions
          tool={tool}
          options={toolOptions}
          onOptionsChange={onToolOptionsChange}
        />

        {/* Merge hint */}
        {mergeNeedsMore && (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-50/50 dark:bg-yellow-900/10 p-3 mt-3">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Merge requires at least 2 files. Add more files above.
            </p>
          </div>
        )}
      </div>

      {/* Footer with process button */}
      <div className="flex items-center gap-3 px-4 py-3 border-t bg-muted/20">
        <Button
          size="default"
          onClick={onProcess}
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
              Process: {operationLabel(tool)}
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="default"
          onClick={onClose}
          className="text-muted-foreground sm:inline-flex hidden"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
