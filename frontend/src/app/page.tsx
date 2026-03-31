'use client';

import React, { useState, useCallback } from 'react';
import { FileDropzone } from '@/components/file-dropzone';
import { PdfEditor } from '@/components/pdf-editor';
import { FileText } from 'lucide-react';

export default function HomePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [editorMode, setEditorMode] = useState(false);

  const handleFilesChange = useCallback((newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFiles(newFiles);
      setEditorMode(true);
    }
  }, []);

  // Editor mode: minimal header + FileEditor
  if (editorMode) {
    return (
      <div className="h-screen flex flex-col">
        {/* Minimal header: logo only, click to go back */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <button
            onClick={() => {
              setEditorMode(false);
              setFiles([]);
            }}
            className="flex items-center gap-2 group"
          >
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary text-primary-foreground">
              <FileText className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">PDFlow</span>
          </button>
        </header>
        <PdfEditor
          initialFiles={files}
          onStartOver={() => {
            setEditorMode(false);
            setFiles([]);
          }}
        />
      </div>
    );
  }

  // Landing mode: ONLY logo + dropzone. Clean and focused.
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary text-primary-foreground">
          <FileText className="h-5.5 w-5.5" />
        </div>
        <span className="text-2xl font-bold tracking-tight">PDFlow</span>
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
    </main>
  );
}
