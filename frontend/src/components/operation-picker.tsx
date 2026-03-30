'use client';

import React from 'react';
import { cn, operationLabel } from '@/lib/utils';
import { Merge, Scissors, Minimize2, Image, Type, Stamp } from 'lucide-react';
import type { OperationType } from '@/types';

const operations: {
  value: OperationType;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    value: 'merge',
    icon: <Merge className="h-6 w-6" />,
    description: 'Combine multiple PDFs into one',
  },
  {
    value: 'split',
    icon: <Scissors className="h-6 w-6" />,
    description: 'Split a PDF into separate pages',
  },
  {
    value: 'compress',
    icon: <Minimize2 className="h-6 w-6" />,
    description: 'Reduce PDF file size',
  },
  {
    value: 'convert_to_png',
    icon: <Image className="h-6 w-6" />,
    description: 'Convert document pages to PNG images',
  },
  {
    value: 'add_text',
    icon: <Type className="h-6 w-6" />,
    description: 'Add text to any page of your PDF',
  },
  {
    value: 'watermark',
    icon: <Stamp className="h-6 w-6" />,
    description: 'Add a watermark across all pages',
  },
];

interface OperationPickerProps {
  value: OperationType | null;
  onChange: (op: OperationType) => void;
}

export function OperationPicker({ value, onChange }: OperationPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {operations.map((op) => {
        const isSelected = value === op.value;
        return (
          <button
            key={op.value}
            type="button"
            onClick={() => onChange(op.value)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all duration-150',
              'hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isSelected
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                : 'border-border hover:border-primary/40 hover:bg-muted/40'
            )}
          >
            <div
              className={cn(
                'rounded-full p-2.5 transition-colors',
                isSelected
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {op.icon}
            </div>
            <div>
              <p
                className={cn(
                  'text-sm font-medium',
                  isSelected && 'text-primary'
                )}
              >
                {operationLabel(op.value)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                {op.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
