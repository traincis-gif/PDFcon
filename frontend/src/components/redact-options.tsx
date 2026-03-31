'use client';

import React from 'react';
import { Trash2, MousePointerSquare } from 'lucide-react';

export interface RedactRegion {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RedactOptions {
  regions: RedactRegion[];
}

export const defaultRedactOptions: RedactOptions = {
  regions: [],
};

interface RedactOptionsFormProps {
  value: RedactOptions;
  onChange: (value: RedactOptions) => void;
}

export function RedactOptionsForm({ value, onChange }: RedactOptionsFormProps) {
  const removeRegion = (index: number) => {
    onChange({
      ...value,
      regions: value.regions.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">Redact Options</h3>
        <p className="text-xs text-muted-foreground">
          Draw rectangles on the document to mark areas for redaction
        </p>
      </div>

      {/* Instruction when no regions */}
      {value.regions.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 flex flex-col items-center gap-2 text-center">
          <MousePointerSquare className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Click and drag on the document to draw redaction rectangles
          </p>
          <p className="text-xs text-muted-foreground">
            On mobile, use a long press and drag
          </p>
        </div>
      )}

      {/* Region list */}
      {value.regions.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            {value.regions.length} region{value.regions.length !== 1 ? 's' : ''} selected
          </div>
          {value.regions.map((region, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-red-500/60" />
                <span className="text-sm font-medium">Page {region.page}:</span>
                <span className="text-xs text-muted-foreground">
                  ({Math.round(region.x)}, {Math.round(region.y)}) - {Math.round(region.width)} x {Math.round(region.height)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeRegion(index)}
                className="text-destructive hover:text-destructive/80 transition-colors p-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
