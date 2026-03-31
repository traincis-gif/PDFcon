'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

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
  regions: [{ page: 1, x: 0, y: 0, width: 100, height: 20 }],
};

interface RedactOptionsFormProps {
  value: RedactOptions;
  onChange: (value: RedactOptions) => void;
}

export function RedactOptionsForm({ value, onChange }: RedactOptionsFormProps) {
  const updateRegion = (index: number, patch: Partial<RedactRegion>) => {
    const newRegions = value.regions.map((r, i) =>
      i === index ? { ...r, ...patch } : r
    );
    onChange({ ...value, regions: newRegions });
  };

  const addRegion = () => {
    onChange({
      ...value,
      regions: [...value.regions, { page: 1, x: 0, y: 0, width: 100, height: 20 }],
    });
  };

  const removeRegion = (index: number) => {
    if (value.regions.length <= 1) return;
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
          Define rectangular regions to black out. Coordinates use PDF coordinate system (0,0 is bottom-left).
        </p>
      </div>

      {value.regions.map((region, index) => (
        <div key={index} className="rounded-md border border-border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Region {index + 1}</span>
            {value.regions.length > 1 && (
              <button
                type="button"
                onClick={() => removeRegion(index)}
                className="text-destructive hover:text-destructive/80 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Page</label>
              <input
                type="number"
                min={1}
                value={region.page}
                onChange={(e) => updateRegion(index, { page: Math.max(1, Number(e.target.value)) })}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">X</label>
              <input
                type="number"
                min={0}
                value={region.x}
                onChange={(e) => updateRegion(index, { x: Math.max(0, Number(e.target.value)) })}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Y</label>
              <input
                type="number"
                min={0}
                value={region.y}
                onChange={(e) => updateRegion(index, { y: Math.max(0, Number(e.target.value)) })}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Width</label>
              <input
                type="number"
                min={1}
                value={region.width}
                onChange={(e) => updateRegion(index, { width: Math.max(1, Number(e.target.value)) })}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Height</label>
              <input
                type="number"
                min={1}
                value={region.height}
                onChange={(e) => updateRegion(index, { height: Math.max(1, Number(e.target.value)) })}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addRegion}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors w-full justify-center"
      >
        <Plus className="h-4 w-4" />
        Add Region
      </button>
    </div>
  );
}
