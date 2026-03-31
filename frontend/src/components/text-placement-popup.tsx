'use client';

import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const colorSwatches = [
  { label: 'Black', value: '#000000' },
  { label: 'Red', value: '#DC2626' },
  { label: 'Blue', value: '#2563EB' },
  { label: 'Green', value: '#16A34A' },
];

interface TextPlacementPopupProps {
  /** Screen X coordinate near click point */
  screenX: number;
  /** Screen Y coordinate near click point */
  screenY: number;
  onAdd: (text: string, fontSize: number, color: string) => void;
  onClose: () => void;
}

export function TextPlacementPopup({
  screenX,
  screenY,
  onAdd,
  onClose,
}: TextPlacementPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [color, setColor] = useState('#000000');

  // Auto-focus the textarea
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Position the popup near the click point, but keep it on screen
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useEffect(() => {
    const popup = popupRef.current;
    if (!popup) return;

    const popupRect = popup.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Offset to the right and slightly below click point
    let left = screenX + 16;
    let top = screenY - 20;

    // Keep on screen
    if (left + popupRect.width > viewportW - 8) {
      left = screenX - popupRect.width - 16;
    }
    if (left < 8) left = 8;

    if (top + popupRect.height > viewportH - 8) {
      top = viewportH - popupRect.height - 8;
    }
    if (top < 8) top = 8;

    setPosition({ left, top });
  }, [screenX, screenY]);

  const handleAdd = () => {
    if (!text.trim()) return;
    onAdd(text, fontSize, color);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-popover border rounded-lg shadow-xl p-3 w-[280px] animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ left: position.left, top: position.top }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type text here..."
        rows={2}
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 resize-none mb-3"
      />

      {/* Font size slider */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-muted-foreground">Size</label>
          <span className="text-xs font-mono tabular-nums text-muted-foreground">{fontSize}px</span>
        </div>
        <input
          type="range"
          min={8}
          max={72}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
        />
      </div>

      {/* Color swatches */}
      <div className="flex items-center gap-1.5 mb-3">
        {colorSwatches.map((swatch) => (
          <button
            key={swatch.value}
            type="button"
            onClick={() => setColor(swatch.value)}
            className={cn(
              'h-6 w-6 rounded-full border-2 transition-all',
              color === swatch.value
                ? 'border-primary scale-110 ring-2 ring-primary/20'
                : 'border-border hover:border-muted-foreground'
            )}
            style={{ backgroundColor: swatch.value }}
            title={swatch.label}
          />
        ))}
      </div>

      {/* Add button */}
      <Button
        size="sm"
        onClick={handleAdd}
        disabled={!text.trim()}
        className="w-full gap-1.5"
      >
        Add Text
      </Button>

      <p className="text-[10px] text-muted-foreground text-center mt-1.5">
        Ctrl+Enter to add quickly
      </p>
    </div>
  );
}
