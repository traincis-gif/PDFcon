'use client';

import React from 'react';
import { cn, operationLabel } from '@/lib/utils';
import type { FileCategory } from '@/lib/file-types';
import { toolsForFileType } from '@/lib/file-types';
import type { OperationType } from '@/types';
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
  ImagePlus,
  FileImage,
  FileOutput,
} from 'lucide-react';

const iconMap: Record<OperationType, React.ElementType> = {
  merge: Merge,
  split: Scissors,
  compress: Minimize2,
  convert_to_png: Image,
  convert_to_jpg: FileImage,
  convert_to_txt: FileOutput,
  convert_to_docx: FileText,
  convert_to_xlsx: FileSpreadsheet,
  convert_to_pptx: Presentation,
  docx_to_pdf: FileText,
  xlsx_to_pdf: FileSpreadsheet,
  pptx_to_pdf: Presentation,
  html_to_pdf: FileText,
  img_to_pdf: ImagePlus,
  add_text: Type,
  watermark: Stamp,
  rotate: RotateCw,
  reorder: ArrowUpDown,
  page_numbers: Hash,
  encrypt: Lock,
  flatten: Layers,
  redact: EyeOff,
  sign: PenTool,
  ocr: ScanText,
};

/** Group definitions for PDF toolbar display */
interface ToolGroupDef {
  label: string;
  tools: OperationType[];
}

const pdfToolGroups: ToolGroupDef[] = [
  { label: 'Edit', tools: ['add_text', 'watermark', 'redact', 'sign'] },
  { label: 'Organize', tools: ['merge', 'split', 'rotate', 'reorder', 'page_numbers'] },
  { label: 'Optimize', tools: ['compress', 'flatten', 'encrypt'] },
  {
    label: 'Convert',
    tools: [
      'convert_to_docx',
      'convert_to_xlsx',
      'convert_to_pptx',
      'convert_to_png',
      'convert_to_jpg',
      'convert_to_txt',
    ],
  },
  { label: 'Extract', tools: ['ocr'] },
];

interface HorizontalToolbarProps {
  fileCategory: FileCategory;
  selectedTool: OperationType | null;
  onSelectTool: (tool: OperationType) => void;
}

export function HorizontalToolbar({
  fileCategory,
  selectedTool,
  onSelectTool,
}: HorizontalToolbarProps) {
  const availableTools = new Set(toolsForFileType[fileCategory]);

  // For non-PDF files (1-2 tools): show larger buttons with labels
  if (fileCategory !== 'pdf') {
    const tools = toolsForFileType[fileCategory];
    return (
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background/95 backdrop-blur">
        {tools.map((tool) => {
          const Icon = iconMap[tool];
          const isSelected = selectedTool === tool;
          return (
            <button
              key={tool}
              type="button"
              onClick={() => onSelectTool(tool)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4" />
              {operationLabel(tool)}
            </button>
          );
        })}
      </div>
    );
  }

  // PDF: grouped icon buttons with tooltips, horizontal scroll on mobile
  return (
    <div className="border-b bg-background/95 backdrop-blur overflow-x-auto">
      <div className="flex items-center gap-0.5 px-2 py-1.5 min-w-max">
        {pdfToolGroups.map((group, gi) => {
          const groupTools = group.tools.filter((t) => availableTools.has(t));
          if (groupTools.length === 0) return null;

          return (
            <React.Fragment key={group.label}>
              {gi > 0 && (
                <div className="w-px h-6 bg-border mx-1 shrink-0" />
              )}
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1.5 hidden sm:block">
                  {group.label}
                </span>
                {groupTools.map((tool) => {
                  const Icon = iconMap[tool];
                  const isSelected = selectedTool === tool;
                  return (
                    <div key={tool} className="relative group/tip">
                      <button
                        type="button"
                        onClick={() => onSelectTool(tool)}
                        className={cn(
                          'flex items-center justify-center rounded-md p-2 transition-all duration-150',
                          'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isSelected
                            ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        title={operationLabel(tool)}
                      >
                        <Icon className={cn('h-4 w-4', isSelected && 'text-primary')} />
                      </button>
                      {/* Tooltip */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 hidden group-hover/tip:block pointer-events-none">
                        <div className="bg-popover text-popover-foreground text-xs font-medium px-2.5 py-1.5 rounded-md shadow-md border whitespace-nowrap">
                          {operationLabel(tool)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
