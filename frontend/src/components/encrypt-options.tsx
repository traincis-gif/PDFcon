'use client';

import React from 'react';

export interface EncryptOptions {
  password: string;
}

export const defaultEncryptOptions: EncryptOptions = {
  password: '',
};

interface EncryptOptionsFormProps {
  value: EncryptOptions;
  onChange: (value: EncryptOptions) => void;
}

export function EncryptOptionsForm({ value, onChange }: EncryptOptionsFormProps) {
  const update = (patch: Partial<EncryptOptions>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">Encrypt Options</h3>
        <p className="text-xs text-muted-foreground">
          Set a password to protect your PDF
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium leading-none">
          Password <span className="text-destructive">*</span>
        </label>
        <input
          type="password"
          value={value.password}
          onChange={(e) => update({ password: e.target.value })}
          placeholder="Enter a password"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <p className="text-xs text-muted-foreground">
          This password will be required to open the PDF.
        </p>
      </div>
    </div>
  );
}
