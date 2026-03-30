'use client';

import React, { useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
}

export function SignOptionsForm({ value, onChange }: SignOptionsFormProps) {
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
      // Strip the data URL prefix to get raw base64
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      update({
        signatureImageBase64: base64,
        signatureFileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            3
          </span>
          <div>
            <CardTitle className="text-lg">Signature Options</CardTitle>
            <CardDescription>
              Upload a signature image and choose where to place it
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">
            Signature Image <span className="text-destructive">*</span>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted/40 transition-colors"
            >
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

        <div className="grid grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Page</label>
            <input
              type="number"
              min={1}
              value={value.page}
              onChange={(e) => update({ page: Math.max(1, Number(e.target.value)) })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">X</label>
            <input
              type="number"
              min={0}
              value={value.x}
              onChange={(e) => update({ x: Math.max(0, Number(e.target.value)) })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Y</label>
            <input
              type="number"
              min={0}
              value={value.y}
              onChange={(e) => update({ y: Math.max(0, Number(e.target.value)) })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Width</label>
            <input
              type="number"
              min={1}
              value={value.width}
              onChange={(e) => update({ width: Math.max(1, Number(e.target.value)) })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Height</label>
            <input
              type="number"
              min={1}
              value={value.height}
              onChange={(e) => update({ height: Math.max(1, Number(e.target.value)) })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
