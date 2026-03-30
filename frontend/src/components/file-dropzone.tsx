'use client';

import React, { useCallback, useState, useRef } from 'react';
import { cn, formatBytes } from '@/lib/utils';
import { Upload, X, FileText } from 'lucide-react';
import { Button } from './ui/button';

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    '.docx',
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    '.xlsx',
  ],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    '.pptx',
  ],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

const ACCEPTED_EXTENSIONS = Object.values(ACCEPTED_TYPES).flat();

interface FileDropzoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  multiple?: boolean;
  maxSizeMB?: number;
  disabled?: boolean;
}

export function FileDropzone({
  files,
  onFilesChange,
  multiple = false,
  maxSizeMB = 50,
  disabled = false,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return `${file.name}: unsupported file type`;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        return `${file.name}: exceeds ${maxSizeMB}MB limit`;
      }
      return null;
    },
    [maxSizeMB]
  );

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      if (disabled) return;
      const fileArray = Array.from(newFiles);
      const errors: string[] = [];
      const valid: File[] = [];

      fileArray.forEach((f) => {
        const err = validateFile(f);
        if (err) errors.push(err);
        else valid.push(f);
      });

      if (errors.length > 0) {
        alert(errors.join('\n'));
      }

      if (multiple) {
        onFilesChange([...files, ...valid]);
      } else {
        onFilesChange(valid.slice(0, 1));
      }
    },
    [files, multiple, onFilesChange, validateFile, disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles, disabled]
  );

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200',
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer',
          isDragOver && !disabled
            ? 'border-primary bg-primary/10 scale-[1.01] shadow-inner'
            : !disabled
              ? 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
              : 'border-muted-foreground/15'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple={multiple}
          accept={ACCEPTED_EXTENSIONS.join(',')}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <Upload
          className={cn(
            'mx-auto h-10 w-10 mb-3 transition-colors',
            isDragOver && !disabled ? 'text-primary' : 'text-muted-foreground'
          )}
        />
        <p className="text-sm font-medium">
          {isDragOver
            ? 'Drop your files here'
            : `Drag and drop ${multiple ? 'files' : 'a file'} here, or click to browse`}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, DOCX, XLSX, PPTX, PNG, JPG up to {maxSizeMB}MB
          {multiple ? ' each' : ''}
        </p>
        {!multiple && files.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Selecting a new file will replace the current one
          </p>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded-md border p-3 bg-muted/30 animate-in fade-in-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
