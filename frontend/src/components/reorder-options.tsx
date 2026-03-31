'use client';

import React from 'react';

export interface ReorderOptions {
  pageOrder: string;
}

export const defaultReorderOptions: ReorderOptions = {
  pageOrder: '',
};

interface ReorderOptionsFormProps {
  value: ReorderOptions;
  onChange: (value: ReorderOptions) => void;
}

export function ReorderOptionsForm({ value, onChange }: ReorderOptionsFormProps) {
  const update = (patch: Partial<ReorderOptions>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">Reorder Options</h3>
        <p className="text-xs text-muted-foreground">
          Specify the new page order as comma-separated page numbers
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium leading-none">
          Page Order <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={value.pageOrder}
          onChange={(e) => update({ pageOrder: e.target.value })}
          placeholder="e.g. 3,1,2,4"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <p className="text-xs text-muted-foreground">
          Enter page numbers in the desired order, separated by commas. For example, &quot;3,1,2,4&quot; puts page 3 first, then page 1, etc.
        </p>
      </div>
    </div>
  );
}
