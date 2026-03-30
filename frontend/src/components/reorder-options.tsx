'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            3
          </span>
          <div>
            <CardTitle className="text-lg">Reorder Options</CardTitle>
            <CardDescription>
              Specify the new page order as comma-separated page numbers
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}
