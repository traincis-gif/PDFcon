'use client';

import React, { useEffect } from 'react';
import { cn, operationLabel } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X, Zap, Loader2 } from 'lucide-react';
import type { OperationType } from '@/types';
import { ToolOptions } from '@/components/tool-options';
import type { ToolOptionsState } from '@/components/tool-options';

interface FloatingToolPanelProps {
  tool: OperationType;
  toolOptions: ToolOptionsState;
  onToolOptionsChange: (options: ToolOptionsState) => void;
  onProcess: () => void;
  onClose: () => void;
  canProcess: boolean;
  isUploading: boolean;
}

export function FloatingToolPanel({
  tool,
  toolOptions,
  onToolOptionsChange,
  onProcess,
  onClose,
  canProcess,
  isUploading,
}: FloatingToolPanelProps) {
  // Close on Escape
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
      className={cn(
        'absolute top-2 left-1/2 -translate-x-1/2 z-30',
        'w-[90%] max-w-md',
        'bg-popover border rounded-xl shadow-xl',
        'animate-in fade-in-0 slide-in-from-top-2 duration-200',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{operationLabel(tool)}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content: tool-specific options */}
      <div className="px-4 py-3 max-h-[50vh] overflow-y-auto">
        <ToolOptions
          tool={tool}
          options={toolOptions}
          onOptionsChange={onToolOptionsChange}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/20 rounded-b-xl">
        <Button
          size="default"
          onClick={onProcess}
          disabled={!canProcess}
          className="gap-2 flex-1"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Process
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="default"
          onClick={onClose}
          className="text-muted-foreground"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
