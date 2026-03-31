'use client';

import React from 'react';

export interface PageNumbersOptions {
  position: string;
  startFrom: number;
  fontSize: number;
  format: string;
}

export const defaultPageNumbersOptions: PageNumbersOptions = {
  position: 'bottom-center',
  startFrom: 1,
  fontSize: 12,
  format: '{n} / {total}',
};

const positionChoices = [
  { label: 'Top Left', value: 'top-left' },
  { label: 'Top Center', value: 'top-center' },
  { label: 'Top Right', value: 'top-right' },
  { label: 'Bottom Left', value: 'bottom-left' },
  { label: 'Bottom Center', value: 'bottom-center' },
  { label: 'Bottom Right', value: 'bottom-right' },
];

interface PageNumbersOptionsFormProps {
  value: PageNumbersOptions;
  onChange: (value: PageNumbersOptions) => void;
}

export function PageNumbersOptionsForm({ value, onChange }: PageNumbersOptionsFormProps) {
  const update = (patch: Partial<PageNumbersOptions>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">Page Numbers Options</h3>
        <p className="text-xs text-muted-foreground">
          Configure how page numbers appear on your PDF
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium leading-none">Position</label>
        <select
          value={value.position}
          onChange={(e) => update({ position: e.target.value })}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {positionChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">Start From</label>
          <input
            type="number"
            min={0}
            value={value.startFrom}
            onChange={(e) => update({ startFrom: Math.max(0, Number(e.target.value)) })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">Font Size</label>
          <input
            type="number"
            min={6}
            max={72}
            value={value.fontSize}
            onChange={(e) => update({ fontSize: Math.max(6, Number(e.target.value)) })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium leading-none">Format</label>
        <input
          type="text"
          value={value.format}
          onChange={(e) => update({ format: e.target.value })}
          placeholder="{n} / {total}"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <p className="text-xs text-muted-foreground">
          Use {'{n}'} for page number and {'{total}'} for total pages. Example: &quot;Page {'{n}'} of {'{total}'}&quot;
        </p>
      </div>
    </div>
  );
}
