'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  opacity: number;
  rotation: number;
  color: string;
}

export const defaultWatermarkOptions: WatermarkOptions = {
  text: '',
  fontSize: 60,
  opacity: 0.15,
  rotation: 45,
  color: '#9CA3AF',
};

const colorPresets = [
  { label: 'Gray', value: '#9CA3AF' },
  { label: 'Red', value: '#DC2626' },
  { label: 'Blue', value: '#2563EB' },
];

interface WatermarkOptionsFormProps {
  value: WatermarkOptions;
  onChange: (value: WatermarkOptions) => void;
}

export function WatermarkOptionsForm({ value, onChange }: WatermarkOptionsFormProps) {
  const update = (patch: Partial<WatermarkOptions>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">Watermark Options</h3>
        <p className="text-xs text-muted-foreground">
          Configure the watermark to apply across all pages
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium leading-none">
          Watermark Text <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={value.text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder="e.g. CONFIDENTIAL, DRAFT..."
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">Font Size</label>
          <input
            type="number"
            min={10}
            max={200}
            value={value.fontSize}
            onChange={(e) => update({ fontSize: Math.max(10, Number(e.target.value)) })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">Rotation (degrees)</label>
          <input
            type="number"
            min={0}
            max={360}
            value={value.rotation}
            onChange={(e) => update({ rotation: Number(e.target.value) })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <label className="text-sm font-medium leading-none">
            Opacity ({Math.round(value.opacity * 100)}%)
          </label>
          <input
            type="range"
            min={0.05}
            max={0.5}
            step={0.01}
            value={value.opacity}
            onChange={(e) => update({ opacity: Number(e.target.value) })}
            className="w-full h-9 accent-primary cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5%</span>
            <span>50%</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium leading-none">Color</label>
        <div className="flex items-center gap-2">
          {colorPresets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => update({ color: preset.value })}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                value.color === preset.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/40 hover:bg-muted/40 text-muted-foreground'
              )}
            >
              <span
                className="h-3 w-3 rounded-full border border-border"
                style={{ backgroundColor: preset.value }}
              />
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
