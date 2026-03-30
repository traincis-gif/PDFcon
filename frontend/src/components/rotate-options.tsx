'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface RotateOptions {
  angle: 90 | 180 | 270;
  pages: string;
}

export const defaultRotateOptions: RotateOptions = {
  angle: 90,
  pages: '',
};

const angleChoices: { label: string; value: 90 | 180 | 270 }[] = [
  { label: '90°', value: 90 },
  { label: '180°', value: 180 },
  { label: '270°', value: 270 },
];

interface RotateOptionsFormProps {
  value: RotateOptions;
  onChange: (value: RotateOptions) => void;
}

export function RotateOptionsForm({ value, onChange }: RotateOptionsFormProps) {
  const update = (patch: Partial<RotateOptions>) => {
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
            <CardTitle className="text-lg">Rotate Options</CardTitle>
            <CardDescription>
              Choose the rotation angle and optionally specify pages
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">
            Angle <span className="text-destructive">*</span>
          </label>
          <div className="flex items-center gap-2">
            {angleChoices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                onClick={() => update({ angle: choice.value })}
                className={cn(
                  'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                  value.angle === choice.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/40 hover:bg-muted/40 text-muted-foreground'
                )}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">
            Pages <span className="text-muted-foreground text-xs">(optional, leave blank for all)</span>
          </label>
          <input
            type="text"
            value={value.pages}
            onChange={(e) => update({ pages: e.target.value })}
            placeholder="e.g. 1,3,5 or leave blank for all pages"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}
