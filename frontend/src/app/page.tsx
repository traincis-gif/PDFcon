'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { FileDropzone } from '@/components/file-dropzone';
import { PdfEditor } from '@/components/pdf-editor';
import { cn } from '@/lib/utils';
import {
  FileText,
  Merge,
  Scissors,
  Minimize2,
  Image,
  Type,
  Stamp,
  RotateCw,
  Lock,
  ScanText,
  Layers,
  PenTool,
  History,
} from 'lucide-react';
import type { OperationType } from '@/types';

const quickTools: { op: OperationType; icon: React.ElementType; label: string }[] = [
  { op: 'merge', icon: Merge, label: 'Merge' },
  { op: 'split', icon: Scissors, label: 'Split' },
  { op: 'compress', icon: Minimize2, label: 'Compress' },
  { op: 'convert_to_png', icon: Image, label: 'PDF to PNG' },
  { op: 'add_text', icon: Type, label: 'Add Text' },
  { op: 'watermark', icon: Stamp, label: 'Watermark' },
  { op: 'rotate', icon: RotateCw, label: 'Rotate' },
  { op: 'encrypt', icon: Lock, label: 'Encrypt' },
  { op: 'flatten', icon: Layers, label: 'Flatten' },
  { op: 'sign', icon: PenTool, label: 'Sign' },
  { op: 'ocr', icon: ScanText, label: 'OCR' },
];

export default function HomePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [editorMode, setEditorMode] = useState(false);

  const handleFilesChange = useCallback((newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFiles(newFiles);
      setEditorMode(true);
    }
  }, []);

  // Editor mode: show the full PDF editor
  if (editorMode) {
    return (
      <div className="h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
          <button
            onClick={() => {
              setEditorMode(false);
              setFiles([]);
            }}
            className="flex items-center gap-2 group"
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
              <FileText className="h-4.5 w-4.5" />
            </div>
            <span className="text-lg font-bold tracking-tight">PDFlow</span>
          </button>
          <div className="flex-1" />
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </Link>
        </header>
        <PdfEditor initialFiles={files} />
      </div>
    );
  }

  // Landing mode: hero dropzone
  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
            <FileText className="h-4.5 w-4.5" />
          </div>
          <span className="text-lg font-bold tracking-tight">PDFlow</span>
        </div>
        <div className="flex-1" />
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">History</span>
        </Link>
      </header>

      {/* Hero section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Free Online PDF Tools
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto">
            Drop a file to merge, split, compress, convert, watermark, sign, and more.
            No installs, no sign-ups.
          </p>
        </div>

        {/* Hero dropzone */}
        <div className="w-full max-w-2xl">
          <FileDropzone
            files={files}
            onFilesChange={handleFilesChange}
            mode="hero"
            multiple={false}
          />
        </div>

        {/* Quick tool icons */}
        <div className="mt-10 w-full max-w-2xl">
          <p className="text-sm text-muted-foreground text-center mb-4">
            Or jump straight to a tool:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {quickTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.op}
                  type="button"
                  onClick={() => setEditorMode(true)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                    'text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tool.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>Your files are processed securely and deleted automatically after processing.</p>
      </footer>
    </main>
  );
}
