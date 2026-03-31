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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { OperationType } from '@/types';

interface ToolDef {
  value: OperationType;
  icon: React.ElementType;
  description: string;
}

interface ToolGroup {
  label: string;
  tools: ToolDef[];
}

const toolGroups: ToolGroup[] = [
  {
    label: 'Convert',
    tools: [
      { value: 'convert_to_docx', icon: FileText, description: 'PDF to Word' },
      { value: 'convert_to_xlsx', icon: FileSpreadsheet, description: 'PDF to Excel' },
      { value: 'convert_to_pptx', icon: Presentation, description: 'PDF to PPT' },
      { value: 'convert_to_jpg', icon: FileImage, description: 'PDF to JPG' },
      { value: 'convert_to_png', icon: Image, description: 'PDF to PNG' },
      { value: 'convert_to_txt', icon: FileOutput, description: 'PDF to Text' },
      { value: 'docx_to_pdf', icon: FileText, description: 'Word to PDF' },
      { value: 'xlsx_to_pdf', icon: FileSpreadsheet, description: 'Excel to PDF' },
      { value: 'pptx_to_pdf', icon: Presentation, description: 'PPT to PDF' },
      { value: 'html_to_pdf', icon: Globe, description: 'HTML to PDF' },
      { value: 'img_to_pdf', icon: ImagePlus, description: 'Images to PDF' },
    ],
  },
  {
    label: 'Edit',
    tools: [
      { value: 'add_text', icon: Type, description: 'Add Text' },
      { value: 'watermark', icon: Stamp, description: 'Watermark' },
      { value: 'redact', icon: EyeOff, description: 'Redact' },
      { value: 'sign', icon: PenTool, description: 'Sign' },
    ],
  },
  {
    label: 'Organize',
    tools: [
      { value: 'merge', icon: Merge, description: 'Merge PDFs' },
      { value: 'split', icon: Scissors, description: 'Split PDF' },
      { value: 'rotate', icon: RotateCw, description: 'Rotate' },
      { value: 'reorder', icon: ArrowUpDown, description: 'Reorder' },
      { value: 'page_numbers', icon: Hash, description: 'Page Numbers' },
    ],
  },
  {
    label: 'Optimize',
    tools: [
      { value: 'compress', icon: Minimize2, description: 'Compress' },
      { value: 'flatten', icon: Layers, description: 'Flatten' },
      { value: 'encrypt', icon: Lock, description: 'Encrypt' },
    ],
  },
  {
    label: 'Extract',
    tools: [
      { value: 'ocr', icon: ScanText, description: 'OCR' },
    ],
  },
];

interface ToolSidebarProps {
  selectedTool: OperationType | null;
  onSelectTool: (tool: OperationType) => void;
  className?: string;
}

export function ToolSidebar({ selectedTool, onSelectTool, className }: ToolSidebarProps) {
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(toolGroups.map((g) => g.label))
  );

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="overflow-y-auto flex-1 py-2">
        {toolGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.label);
          return (
            <div key={group.label} className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {group.label}
              </button>
              {isExpanded && (
                <div className="space-y-0.5 px-1.5">
                  {group.tools.map((tool) => {
                    const isSelected = selectedTool === tool.value;
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.value}
                        type="button"
                        onClick={() => onSelectTool(tool.value)}
                        className={cn(
                          'flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm transition-all duration-150',
                          'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isSelected
                            ? 'bg-primary/10 text-primary font-medium shadow-sm border border-primary/20'
                            : 'text-foreground/80 hover:text-foreground'
                        )}
                        title={operationLabel(tool.value)}
                      >
                        <Icon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            isSelected ? 'text-primary' : 'text-muted-foreground'
                          )}
                        />
                        <span className="truncate text-left">{operationLabel(tool.value)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Mobile-friendly horizontal tool bar for bottom sheet */
export function ToolBarMobile({
  selectedTool,
  onSelectTool,
}: {
  selectedTool: OperationType | null;
  onSelectTool: (tool: OperationType) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1.5 px-3 py-2 min-w-max">
        {toolGroups.map((group) =>
          group.tools.map((tool) => {
            const isSelected = selectedTool === tool.value;
            const Icon = tool.icon;
            return (
              <button
                key={tool.value}
                type="button"
                onClick={() => onSelectTool(tool.value)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs transition-all shrink-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected
                    ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{operationLabel(tool.value)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
