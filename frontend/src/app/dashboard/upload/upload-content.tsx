'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileDropzone } from '@/components/file-dropzone';
import { OperationPicker } from '@/components/operation-picker';
import { TextOptionsForm, defaultTextOptions } from '@/components/text-options';
import { WatermarkOptionsForm, defaultWatermarkOptions } from '@/components/watermark-options';
import { RotateOptionsForm, defaultRotateOptions } from '@/components/rotate-options';
import { ReorderOptionsForm, defaultReorderOptions } from '@/components/reorder-options';
import { EncryptOptionsForm, defaultEncryptOptions } from '@/components/encrypt-options';
import { PageNumbersOptionsForm, defaultPageNumbersOptions } from '@/components/page-numbers-options';
import { RedactOptionsForm, defaultRedactOptions } from '@/components/redact-options';
import { SignOptionsForm, defaultSignOptions } from '@/components/sign-options';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import type { OperationType } from '@/types';
import type { TextOptions } from '@/components/text-options';
import type { WatermarkOptions } from '@/components/watermark-options';
import type { RotateOptions } from '@/components/rotate-options';
import type { ReorderOptions } from '@/components/reorder-options';
import type { EncryptOptions } from '@/components/encrypt-options';
import type { PageNumbersOptions } from '@/components/page-numbers-options';
import type { RedactOptions } from '@/components/redact-options';
import type { SignOptions } from '@/components/sign-options';

const operationHints: Record<OperationType, string> = {
  merge: 'Upload multiple PDF files to combine them into a single document.',
  split: 'Upload one PDF to split it into separate pages.',
  compress: 'Upload one PDF to reduce its file size.',
  convert_to_png: 'Upload a PDF to convert each page to a PNG image.',
  convert_to_jpg: 'Upload a PDF to convert each page to a JPG image.',
  convert_to_txt: 'Upload a PDF to extract its text content.',
  convert_to_docx: 'Upload a PDF to convert it to a Word document.',
  convert_to_xlsx: 'Upload a PDF to convert it to an Excel spreadsheet.',
  convert_to_pptx: 'Upload a PDF to convert it to a PowerPoint presentation.',
  docx_to_pdf: 'Upload a Word document (.docx) to convert it to PDF.',
  xlsx_to_pdf: 'Upload an Excel spreadsheet (.xlsx) to convert it to PDF.',
  pptx_to_pdf: 'Upload a PowerPoint presentation (.pptx) to convert it to PDF.',
  html_to_pdf: 'Upload an HTML file to convert it to PDF.',
  img_to_pdf: 'Upload one or more images (PNG, JPG) to convert them into a PDF.',
  add_text: 'Upload one PDF to add text to a specific page.',
  watermark: 'Upload one PDF to add a watermark across all pages.',
  rotate: 'Upload one PDF to rotate its pages.',
  reorder: 'Upload one PDF to rearrange its pages.',
  page_numbers: 'Upload one PDF to add page numbers.',
  encrypt: 'Upload one PDF to password-protect it.',
  flatten: 'Upload one PDF to flatten form fields into static content.',
  redact: 'Upload one PDF to black out sensitive areas.',
  sign: 'Upload one PDF to add a signature image.',
  ocr: 'Upload one PDF to extract text using OCR.',
};

/** Operations that accept multiple files */
const multiFileOps: Set<OperationType> = new Set(['merge', 'img_to_pdf']);

/** Operations that accept image files instead of PDFs */
const imageInputOps: Set<OperationType> = new Set(['img_to_pdf']);

/** Operations that need an options form */
const opsWithOptions: Set<OperationType> = new Set([
  'add_text',
  'watermark',
  'rotate',
  'reorder',
  'encrypt',
  'page_numbers',
  'redact',
  'sign',
]);

export function UploadContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [operation, setOperation] = useState<OperationType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [textOptions, setTextOptions] = useState<TextOptions>(defaultTextOptions);
  const [watermarkOptions, setWatermarkOptions] = useState<WatermarkOptions>(defaultWatermarkOptions);
  const [rotateOptions, setRotateOptions] = useState<RotateOptions>(defaultRotateOptions);
  const [reorderOptions, setReorderOptions] = useState<ReorderOptions>(defaultReorderOptions);
  const [encryptOptions, setEncryptOptions] = useState<EncryptOptions>(defaultEncryptOptions);
  const [pageNumbersOptions, setPageNumbersOptions] = useState<PageNumbersOptions>(defaultPageNumbersOptions);
  const [redactOptions, setRedactOptions] = useState<RedactOptions>(defaultRedactOptions);
  const [signOptions, setSignOptions] = useState<SignOptions>(defaultSignOptions);

  const isMultiple = operation !== null && multiFileOps.has(operation);
  const isImageInput = operation !== null && imageInputOps.has(operation);

  const canSubmit = (() => {
    if (files.length === 0 || operation === null || uploading) return false;
    if (operation === 'add_text' && !textOptions.text.trim()) return false;
    if (operation === 'watermark' && !watermarkOptions.text.trim()) return false;
    if (operation === 'encrypt' && !encryptOptions.password.trim()) return false;
    if (operation === 'reorder' && !reorderOptions.pageOrder.trim()) return false;
    if (operation === 'sign' && !signOptions.signatureImageBase64) return false;
    if (operation === 'redact' && redactOptions.regions.length === 0) return false;
    return true;
  })();

  const handleSubmit = async () => {
    if (!canSubmit || !operation) return;

    if (operation === 'merge' && files.length < 2) {
      toast({
        title: 'Need more files',
        description: 'Merge requires at least 2 files.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      let metadata: Record<string, unknown> | undefined;

      if (operation === 'add_text') {
        metadata = {
          text: textOptions.text,
          page: textOptions.page,
          x: textOptions.x,
          y: textOptions.y,
          fontSize: textOptions.fontSize,
          color: textOptions.color,
        };
      } else if (operation === 'watermark') {
        metadata = {
          text: watermarkOptions.text,
          fontSize: watermarkOptions.fontSize,
          opacity: watermarkOptions.opacity,
          rotation: watermarkOptions.rotation,
          color: watermarkOptions.color,
        };
      } else if (operation === 'rotate') {
        metadata = {
          angle: rotateOptions.angle,
          ...(rotateOptions.pages.trim() ? { pages: rotateOptions.pages.trim() } : {}),
        };
      } else if (operation === 'reorder') {
        const pageOrder = reorderOptions.pageOrder
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
        metadata = { pageOrder };
      } else if (operation === 'encrypt') {
        metadata = { password: encryptOptions.password };
      } else if (operation === 'page_numbers') {
        metadata = {
          position: pageNumbersOptions.position,
          startFrom: pageNumbersOptions.startFrom,
          fontSize: pageNumbersOptions.fontSize,
          format: pageNumbersOptions.format,
        };
      } else if (operation === 'redact') {
        metadata = { regions: redactOptions.regions };
      } else if (operation === 'sign') {
        metadata = {
          signatureImageBase64: signOptions.signatureImageBase64,
          page: signOptions.page,
          x: signOptions.x,
          y: signOptions.y,
          width: signOptions.width,
          height: signOptions.height,
        };
      }

      const res = await api.uploadAndProcess(files, operation, (pct) => {
        setProgress(pct);
      }, metadata);

      toast({
        title: 'Job started',
        description: 'Your files are being processed.',
      });
      // Support both `id` and `job_id` from the API response
      const jobId = res.job_id || res.id;
      router.push(`/dashboard/jobs/${jobId}`);
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Files</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select an operation and upload your files
        </p>
      </div>

      {/* Step 1: Choose Operation */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
              1
            </span>
            <div>
              <CardTitle className="text-lg">Choose Operation</CardTitle>
              <CardDescription>
                What would you like to do with your files?
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <OperationPicker
            value={operation}
            onChange={(op) => {
              setOperation(op);
              if (!multiFileOps.has(op) && files.length > 1) {
                setFiles(files.slice(0, 1));
              }
              // Clear files if switching between image and PDF input modes
              if (imageInputOps.has(op) !== (operation !== null && imageInputOps.has(operation))) {
                setFiles([]);
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Step 2: Upload Files */}
      <Card
        className={!operation ? 'opacity-60 pointer-events-none' : undefined}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
              2
            </span>
            <div>
              <CardTitle className="text-lg">Upload Files</CardTitle>
              <CardDescription>
                {operation
                  ? operationHints[operation]
                  : 'Select an operation first to continue.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FileDropzone
            files={files}
            onFilesChange={setFiles}
            multiple={isMultiple}
            disabled={!operation}
            accept={isImageInput ? { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] } : undefined}
          />
        </CardContent>
      </Card>

      {/* Step 3: Operation-specific options */}
      {operation === 'add_text' && (
        <TextOptionsForm value={textOptions} onChange={setTextOptions} />
      )}
      {operation === 'watermark' && (
        <WatermarkOptionsForm value={watermarkOptions} onChange={setWatermarkOptions} />
      )}
      {operation === 'rotate' && (
        <RotateOptionsForm value={rotateOptions} onChange={setRotateOptions} />
      )}
      {operation === 'reorder' && (
        <ReorderOptionsForm value={reorderOptions} onChange={setReorderOptions} />
      )}
      {operation === 'encrypt' && (
        <EncryptOptionsForm value={encryptOptions} onChange={setEncryptOptions} />
      )}
      {operation === 'page_numbers' && (
        <PageNumbersOptionsForm value={pageNumbersOptions} onChange={setPageNumbersOptions} />
      )}
      {operation === 'redact' && (
        <RedactOptionsForm value={redactOptions} onChange={setRedactOptions} />
      )}
      {operation === 'sign' && (
        <SignOptionsForm value={signOptions} onChange={setSignOptions} />
      )}

      {/* Upload Progress */}
      {uploading && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Uploading your files...
                </span>
                <span className="font-semibold text-primary">{progress}%</span>
              </div>
              <Progress value={progress} />
              {progress === 100 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Upload complete, starting processing...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="gap-2 min-w-[180px]"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              Start Processing
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
