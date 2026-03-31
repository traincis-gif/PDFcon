'use client';

import React from 'react';
import { TextOptionsForm, defaultTextOptions } from '@/components/text-options';
import { WatermarkOptionsForm, defaultWatermarkOptions } from '@/components/watermark-options';
import { RotateOptionsForm, defaultRotateOptions } from '@/components/rotate-options';
import { ReorderOptionsForm, defaultReorderOptions } from '@/components/reorder-options';
import { EncryptOptionsForm, defaultEncryptOptions } from '@/components/encrypt-options';
import { PageNumbersOptionsForm, defaultPageNumbersOptions } from '@/components/page-numbers-options';
import { RedactOptionsForm, defaultRedactOptions } from '@/components/redact-options';
import { SignOptionsForm, defaultSignOptions } from '@/components/sign-options';
import type { TextOptions } from '@/components/text-options';
import type { WatermarkOptions } from '@/components/watermark-options';
import type { RotateOptions } from '@/components/rotate-options';
import type { ReorderOptions } from '@/components/reorder-options';
import type { EncryptOptions } from '@/components/encrypt-options';
import type { PageNumbersOptions } from '@/components/page-numbers-options';
import type { RedactOptions } from '@/components/redact-options';
import type { SignOptions } from '@/components/sign-options';
import type { OperationType } from '@/types';
import { operationLabel } from '@/lib/utils';
import {
  Scissors,
  Minimize2,
  Image,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileImage,
  FileOutput,
  Globe,
  ImagePlus,
  Layers,
  ScanText,
  Merge,
} from 'lucide-react';

/** Descriptions for tools that have no options form */
const simpleToolDescriptions: Partial<Record<OperationType, { description: string; icon: React.ElementType }>> = {
  split: {
    description: 'Split your PDF into separate individual pages. Each page will be extracted as its own file.',
    icon: Scissors,
  },
  compress: {
    description: 'Reduce your PDF file size while preserving quality. Great for email attachments and web uploads.',
    icon: Minimize2,
  },
  convert_to_png: {
    description: 'Convert each page of your PDF into a high-quality PNG image.',
    icon: Image,
  },
  convert_to_jpg: {
    description: 'Convert each page of your PDF into a JPG image.',
    icon: FileImage,
  },
  convert_to_txt: {
    description: 'Extract all text content from your PDF into a plain text file.',
    icon: FileOutput,
  },
  convert_to_docx: {
    description: 'Convert your PDF to an editable Word document (.docx).',
    icon: FileText,
  },
  convert_to_xlsx: {
    description: 'Convert your PDF tables to an Excel spreadsheet (.xlsx).',
    icon: FileSpreadsheet,
  },
  convert_to_pptx: {
    description: 'Convert your PDF to a PowerPoint presentation (.pptx).',
    icon: Presentation,
  },
  docx_to_pdf: {
    description: 'Convert your Word document (.docx) to PDF format.',
    icon: FileText,
  },
  xlsx_to_pdf: {
    description: 'Convert your Excel spreadsheet (.xlsx) to PDF format.',
    icon: FileSpreadsheet,
  },
  pptx_to_pdf: {
    description: 'Convert your PowerPoint presentation (.pptx) to PDF format.',
    icon: Presentation,
  },
  html_to_pdf: {
    description: 'Convert your HTML file to PDF format with proper rendering.',
    icon: Globe,
  },
  img_to_pdf: {
    description: 'Convert one or more images (PNG, JPG) into a single PDF document.',
    icon: ImagePlus,
  },
  flatten: {
    description: 'Flatten all form fields and annotations into static content. The PDF will no longer be editable.',
    icon: Layers,
  },
  ocr: {
    description: 'Extract text from scanned PDFs using Optical Character Recognition (OCR).',
    icon: ScanText,
  },
  merge: {
    description: 'Combine multiple PDF files into a single document. Add more files using the file area above.',
    icon: Merge,
  },
};

export interface ToolOptionsState {
  textOptions: TextOptions;
  watermarkOptions: WatermarkOptions;
  rotateOptions: RotateOptions;
  reorderOptions: ReorderOptions;
  encryptOptions: EncryptOptions;
  pageNumbersOptions: PageNumbersOptions;
  redactOptions: RedactOptions;
  signOptions: SignOptions;
}

export const defaultToolOptionsState: ToolOptionsState = {
  textOptions: defaultTextOptions,
  watermarkOptions: defaultWatermarkOptions,
  rotateOptions: defaultRotateOptions,
  reorderOptions: defaultReorderOptions,
  encryptOptions: defaultEncryptOptions,
  pageNumbersOptions: defaultPageNumbersOptions,
  redactOptions: defaultRedactOptions,
  signOptions: defaultSignOptions,
};

interface ToolOptionsProps {
  tool: OperationType;
  options: ToolOptionsState;
  onOptionsChange: (options: ToolOptionsState) => void;
}

export function ToolOptions({ tool, options, onOptionsChange }: ToolOptionsProps) {
  // Render the appropriate form for tools that need options
  switch (tool) {
    case 'add_text':
      return (
        <div className="space-y-0">
          <TextOptionsForm
            value={options.textOptions}
            onChange={(textOptions) => onOptionsChange({ ...options, textOptions })}
          />
        </div>
      );
    case 'watermark':
      return (
        <div className="space-y-0">
          <WatermarkOptionsForm
            value={options.watermarkOptions}
            onChange={(watermarkOptions) => onOptionsChange({ ...options, watermarkOptions })}
          />
        </div>
      );
    case 'rotate':
      return (
        <div className="space-y-0">
          <RotateOptionsForm
            value={options.rotateOptions}
            onChange={(rotateOptions) => onOptionsChange({ ...options, rotateOptions })}
          />
        </div>
      );
    case 'reorder':
      return (
        <div className="space-y-0">
          <ReorderOptionsForm
            value={options.reorderOptions}
            onChange={(reorderOptions) => onOptionsChange({ ...options, reorderOptions })}
          />
        </div>
      );
    case 'encrypt':
      return (
        <div className="space-y-0">
          <EncryptOptionsForm
            value={options.encryptOptions}
            onChange={(encryptOptions) => onOptionsChange({ ...options, encryptOptions })}
          />
        </div>
      );
    case 'page_numbers':
      return (
        <div className="space-y-0">
          <PageNumbersOptionsForm
            value={options.pageNumbersOptions}
            onChange={(pageNumbersOptions) => onOptionsChange({ ...options, pageNumbersOptions })}
          />
        </div>
      );
    case 'redact':
      return (
        <div className="space-y-0">
          <RedactOptionsForm
            value={options.redactOptions}
            onChange={(redactOptions) => onOptionsChange({ ...options, redactOptions })}
          />
        </div>
      );
    case 'sign':
      return (
        <div className="space-y-0">
          <SignOptionsForm
            value={options.signOptions}
            onChange={(signOptions) => onOptionsChange({ ...options, signOptions })}
          />
        </div>
      );
    default: {
      // Simple tools with no options -- show description
      const info = simpleToolDescriptions[tool];
      if (info) {
        const Icon = info.icon;
        return (
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2.5 shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1">{operationLabel(tool)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {info.description}
                </p>
              </div>
            </div>
          </div>
        );
      }
      return null;
    }
  }
}

/** Build metadata object from options state for a given tool */
export function buildMetadata(
  tool: OperationType,
  options: ToolOptionsState
): Record<string, unknown> | undefined {
  switch (tool) {
    case 'add_text':
      return {
        text: options.textOptions.text,
        page: options.textOptions.page,
        x: options.textOptions.x,
        y: options.textOptions.y,
        fontSize: options.textOptions.fontSize,
        color: options.textOptions.color,
      };
    case 'watermark':
      return {
        text: options.watermarkOptions.text,
        fontSize: options.watermarkOptions.fontSize,
        opacity: options.watermarkOptions.opacity,
        rotation: options.watermarkOptions.rotation,
        color: options.watermarkOptions.color,
      };
    case 'rotate':
      return {
        angle: options.rotateOptions.angle,
        ...(options.rotateOptions.pages.trim()
          ? { pages: options.rotateOptions.pages.trim() }
          : {}),
      };
    case 'reorder': {
      const pageOrder = options.reorderOptions.pageOrder
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      return { pageOrder };
    }
    case 'encrypt':
      return { password: options.encryptOptions.password };
    case 'page_numbers':
      return {
        position: options.pageNumbersOptions.position,
        startFrom: options.pageNumbersOptions.startFrom,
        fontSize: options.pageNumbersOptions.fontSize,
        format: options.pageNumbersOptions.format,
      };
    case 'redact':
      return { regions: options.redactOptions.regions };
    case 'sign':
      return {
        signatureImageBase64: options.signOptions.signatureImageBase64,
        page: options.signOptions.page,
        x: options.signOptions.x,
        y: options.signOptions.y,
        width: options.signOptions.width,
        height: options.signOptions.height,
      };
    default:
      return undefined;
  }
}

/** Check if the current options are valid for submission */
export function validateOptions(
  tool: OperationType,
  options: ToolOptionsState
): boolean {
  switch (tool) {
    case 'add_text':
      return !!options.textOptions.text.trim();
    case 'watermark':
      return !!options.watermarkOptions.text.trim();
    case 'encrypt':
      return !!options.encryptOptions.password.trim();
    case 'reorder':
      return !!options.reorderOptions.pageOrder.trim();
    case 'sign':
      return !!options.signOptions.signatureImageBase64;
    case 'redact':
      return options.redactOptions.regions.length > 0;
    default:
      return true;
  }
}
