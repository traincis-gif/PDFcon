'use client';

import React from 'react';
import { cn, operationLabel } from '@/lib/utils';
import { Merge, Scissors, Minimize2, Image } from 'lucide-react';
import type { OperationType } from '@/types';

const operations: { value: OperationType; icon: React.ReactNode; description: string }[] = [
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
];

interface OperationPickerProps {
  value: OperationType | null;
  onChange: (op: OperationType) => void;
}

export function OperationPicker({ value, onChange }: OperationPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {operations.map((op) => (
        <button
          key={op.value}
          type="button"
          onClick={() => onChange(op.value)}
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all hover:border-primary/50 hover:shadow-sm',
            value === op.value
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
              : 'border-border'
          )}
        >
          <div
            className={cn(
              'rounded-full p-2',
              value === op.value ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {op.icon}
          </div>
          <div>
            <p className="text-sm font-medium">{operationLabel(op.value)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{op.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
