'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';

export interface TextOptions {
  text: string;
  page: number;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

export const defaultTextOptions: TextOptions = {
  text: '',
  page: 1,
  x: 50,
  y: 700,
  fontSize: 16,
  color: '#000000',
};

const colorPresets = [
  { label: 'Black', value: '#000000' },
  { label: 'Red', value: '#DC2626' },
  { label: 'Blue', value: '#2563EB' },
  { label: 'Green', value: '#16A34A' },
];

interface TextOptionsFormProps {
  value: TextOptions;
  onChange: (value: TextOptions) => void;
  /** Whether placement has been set via viewer click */
  hasPlacement?: boolean;
}

export function TextOptionsForm({ value, onChange, hasPlacement }: TextOptionsFormProps) {
  const update = (patch: Partial<TextOptions>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">Add Text Options</h3>
        <p className="text-xs text-muted-foreground">
          Type your text below, then click on the document to place it
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium leading-none">
          Text <span className="text-destructive">*</span>
        </label>
        <textarea
          value={value.text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder="Enter the text to add..."
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">Font Size</label>
          <input
            type="number"
            min={1}
            max={200}
            value={value.fontSize}
            onChange={(e) => update({ fontSize: Math.max(1, Number(e.target.value)) })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">Color</label>
          <div className="flex items-center gap-2 pt-0.5">
            {colorPresets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => update({ color: preset.value })}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
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

      {/* Placement info / instruction */}
      <div className={cn(
        'rounded-md border p-3 flex items-center gap-2',
        hasPlacement
          ? 'border-primary/30 bg-primary/5'
          : 'border-dashed border-border bg-muted/30'
      )}>
        <MapPin className={cn('h-4 w-4 shrink-0', hasPlacement ? 'text-primary' : 'text-muted-foreground')} />
        {hasPlacement ? (
          <span className="text-sm">
            <span className="font-medium">Page {value.page}</span>, position ({Math.round(value.x)}, {Math.round(value.y)})
            <span className="text-xs text-muted-foreground ml-2">Click again to reposition</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            Click on the document where you want to place the text
          </span>
        )}
      </div>
    </div>
  );
}
