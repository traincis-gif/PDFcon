'use client';

import React from 'react';
import { cn, operationLabel } from '@/lib/utils';
import {
  Merge,
  Scissors,
  Minimize2,
  Image,
  Type,
  Stamp,
  FileText,
  FileSpreadsheet,
  Presentation,
  RotateCw,
  ArrowUpDown,
  Hash,
  Lock,
  Layers,
  EyeOff,
  PenTool,
  ScanText,
  Globe,
  ImagePlus,
  FileImage,
  FileOutput,
} from 'lucide-react';
import type { OperationType } from '@/types';

interface OperationDef {
  value: OperationType;
  icon: React.ReactNode;
  description: string;
}

const operationGroups: {
  label: string;
  operations: OperationDef[];
}[] = [
  {
    label: 'Convert',
    operations: [
      {
        value: 'convert_to_docx',
        icon: <FileText className="h-6 w-6" />,
        description: 'Convert PDF to Word document',
      },
      {
        value: 'convert_to_xlsx',
        icon: <FileSpreadsheet className="h-6 w-6" />,
        description: 'Convert PDF to Excel spreadsheet',
      },
      {
        value: 'convert_to_pptx',
        icon: <Presentation className="h-6 w-6" />,
        description: 'Convert PDF to PowerPoint',
      },
      {
        value: 'convert_to_jpg',
        icon: <FileImage className="h-6 w-6" />,
        description: 'Convert PDF pages to JPG images',
      },
      {
        value: 'convert_to_png',
        icon: <Image className="h-6 w-6" />,
        description: 'Convert PDF pages to PNG images',
      },
      {
        value: 'convert_to_txt',
        icon: <FileOutput className="h-6 w-6" />,
        description: 'Extract text from PDF',
      },
      {
        value: 'docx_to_pdf',
        icon: <FileText className="h-6 w-6" />,
        description: 'Convert Word document to PDF',
      },
      {
        value: 'xlsx_to_pdf',
        icon: <FileSpreadsheet className="h-6 w-6" />,
        description: 'Convert Excel spreadsheet to PDF',
      },
      {
        value: 'pptx_to_pdf',
        icon: <Presentation className="h-6 w-6" />,
        description: 'Convert PowerPoint to PDF',
      },
      {
        value: 'html_to_pdf',
        icon: <Globe className="h-6 w-6" />,
        description: 'Convert HTML file to PDF',
      },
      {
        value: 'img_to_pdf',
        icon: <ImagePlus className="h-6 w-6" />,
        description: 'Convert images (PNG, JPG) to PDF',
      },
    ],
  },
  {
    label: 'Process',
    operations: [
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
        value: 'rotate',
        icon: <RotateCw className="h-6 w-6" />,
        description: 'Rotate PDF pages by 90, 180, or 270 degrees',
      },
      {
        value: 'reorder',
        icon: <ArrowUpDown className="h-6 w-6" />,
        description: 'Rearrange pages in a PDF',
      },
      {
        value: 'page_numbers',
        icon: <Hash className="h-6 w-6" />,
        description: 'Add page numbers to every page',
      },
      {
        value: 'flatten',
        icon: <Layers className="h-6 w-6" />,
        description: 'Flatten form fields into static content',
      },
    ],
  },
  {
    label: 'Edit',
    operations: [
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
      {
        value: 'redact',
        icon: <EyeOff className="h-6 w-6" />,
        description: 'Black out sensitive areas in your PDF',
      },
      {
        value: 'sign',
        icon: <PenTool className="h-6 w-6" />,
        description: 'Add a signature image to your PDF',
      },
    ],
  },
  {
    label: 'Extract',
    operations: [
      {
        value: 'ocr',
        icon: <ScanText className="h-6 w-6" />,
        description: 'Extract text from scanned PDFs using OCR',
      },
    ],
  },
  {
    label: 'Security',
    operations: [
      {
        value: 'encrypt',
        icon: <Lock className="h-6 w-6" />,
        description: 'Password-protect your PDF',
      },
    ],
  },
];

interface OperationPickerProps {
  value: OperationType | null;
  onChange: (op: OperationType) => void;
}

export function OperationPicker({ value, onChange }: OperationPickerProps) {
  return (
    <div className="space-y-6">
      {operationGroups.map((group) => (
        <div key={group.label}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            {group.label}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {group.operations.map((op) => {
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
        </div>
      ))}
    </div>
  );
}
