'use client';

import React, { useRef } from 'react';
import { MapPin, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SignOptions {
  signatureImageBase64: string;
  signatureFileName: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const defaultSignOptions: SignOptions = {
  signatureImageBase64: '',
  signatureFileName: '',
  page: 1,
  x: 50,
  y: 50,
  width: 200,
  height: 80,
};

interface SignOptionsFormProps {
  value: SignOptions;
  onChange: (value: SignOptions) => void;
  /** Whether placement has been set via viewer click */
  hasPlacement?: boolean;
}

export function SignOptionsForm({ value, onChange, hasPlacement }: SignOptionsFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<SignOptions>) => {
    onChange({ ...value, ...patch });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      update({
        signatureImageBase64: base64,
        signatureFileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">Signature Options</h3>
        <p className="text-xs text-muted-foreground">
          Upload your signature image, then click on the document to place it
        </p>
      </div>

      {/* Signature upload */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium leading-none">
          Signature Image <span className="text-destructive">*</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted/40 transition-colors flex items-center gap-2"
          >
            <Upload className="h-3.5 w-3.5" />
            {value.signatureFileName || 'Choose Image'}
          </button>
          {value.signatureFileName && (
            <span className="text-xs text-muted-foreground">{value.signatureFileName}</span>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handleFileChange}
          className="hidden"
        />
        <p className="text-xs text-muted-foreground">
          Upload a PNG or JPG image of your signature.
        </p>
      </div>

      {/* Signature preview thumbnail */}
      {value.signatureImageBase64 && (
        <div className="rounded-md border bg-muted/20 p-3 flex items-center gap-3">
          <img
            src={`data:image/png;base64,${value.signatureImageBase64}`}
            alt="Signature preview"
            className="h-10 max-w-[120px] object-contain border rounded bg-white p-1"
          />
          <span className="text-xs text-muted-foreground">Signature loaded</span>
        </div>
      )}

      {/* Size controls */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">Width (pts)</label>
          <input
            type="number"
            min={20}
            max={600}
            value={value.width}
            onChange={(e) => update({ width: Math.max(20, Number(e.target.value)) })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">Height (pts)</label>
          <input
            type="number"
            min={10}
            max={400}
            value={value.height}
            onChange={(e) => update({ height: Math.max(10, Number(e.target.value)) })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </div>

      {/* Placement info / instruction */}
      <div className={cn(
        'rounded-md border p-3 flex items-center gap-2',
        hasPlacement
          ? 'border-primary/30 bg-primary/5'
          : 'border-dashed border-border bg-muted/30'
      )}>
        <MapPin className={cn('h-4 w-4 shrink-0', hasPlacement ? 'text-primary' : 'text-muted-foreground')} />
        {hasPlacement ? (
          <span className="text-sm">
            <span className="font-medium">Page {value.page}</span>, position ({Math.round(value.x)}, {Math.round(value.y)})
            <span className="text-xs text-muted-foreground ml-2">Click again to reposition</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {value.signatureImageBase64
              ? 'Click on the document to place your signature'
              : 'Upload a signature image first, then click on the document to place it'}
          </span>
        )}
      </div>
    </div>
  );
}
