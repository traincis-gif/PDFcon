'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  X,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RichTextPlacement } from '@/types';

/* ─── Font families ─── */
const fontFamilies = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Courier',
  'Georgia',
  'Verdana',
] as const;

/* ─── Preset font sizes ─── */
const fontSizePresets = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72];

/* ─── Color swatches ─── */
const colorSwatches = [
  { label: 'Black', value: '#000000' },
  { label: 'Red', value: '#DC2626' },
  { label: 'Blue', value: '#2563EB' },
  { label: 'Green', value: '#16A34A' },
  { label: 'Orange', value: '#EA580C' },
  { label: 'Purple', value: '#9333EA' },
  { label: 'White', value: '#FFFFFF' },
];

/* ─── Line height presets ─── */
const lineHeightPresets = [
  { label: '1.0', value: 1.0 },
  { label: '1.15', value: 1.15 },
  { label: '1.5', value: 1.5 },
  { label: '2.0', value: 2.0 },
];

/* ─── Props ─── */
export interface TextPlacementPopupProps {
  screenX: number;
  screenY: number;
  onAdd: (placement: Omit<RichTextPlacement, 'page' | 'x' | 'y'>) => void;
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

  /* ─── State ─── */
  const [text, setText] = useState('');
  const [fontFamily, setFontFamily] = useState<string>('Arial');
  const [fontSize, setFontSize] = useState(16);
  const [fontSizeInput, setFontSizeInput] = useState('16');
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [strikethrough, setStrikethrough] = useState(false);
  const [color, setColor] = useState('#000000');
  const [customColor, setCustomColor] = useState('#000000');
  const [showCustomColor, setShowCustomColor] = useState(false);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('left');
  const [lineHeight, setLineHeight] = useState(1.5);
  const [opacity, setOpacity] = useState(100);

  /* ─── Dropdown open states ─── */
  const [fontFamilyOpen, setFontFamilyOpen] = useState(false);
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const [lineHeightOpen, setLineHeightOpen] = useState(false);

  /* ─── Auto-focus textarea ─── */
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  /* ─── Close on Escape ─── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  /* ─── Close dropdowns on outside click ─── */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setFontFamilyOpen(false);
        setFontSizeOpen(false);
        setLineHeightOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ─── Position the popup near the click point ─── */
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useEffect(() => {
    const popup = popupRef.current;
    if (!popup) return;

    const popupRect = popup.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let left = screenX + 16;
    let top = screenY - 20;

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

  /* ─── Font size handling ─── */
  const handleFontSizeInputChange = useCallback((val: string) => {
    setFontSizeInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= 200) {
      setFontSize(num);
    }
  }, []);

  const handleFontSizeSelect = useCallback((size: number) => {
    setFontSize(size);
    setFontSizeInput(String(size));
    setFontSizeOpen(false);
  }, []);

  /* ─── Custom color handling ─── */
  const handleCustomColorApply = useCallback(() => {
    const hex = customColor.startsWith('#') ? customColor : `#${customColor}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setColor(hex);
      setShowCustomColor(false);
    }
  }, [customColor]);

  /* ─── Submit ─── */
  const handleAdd = useCallback(() => {
    if (!text.trim()) return;
    onAdd({
      text,
      fontSize,
      fontFamily,
      bold,
      italic,
      underline,
      strikethrough,
      color,
      alignment,
      lineHeight,
      opacity: opacity / 100,
    });
  }, [text, fontSize, fontFamily, bold, italic, underline, strikethrough, color, alignment, lineHeight, opacity, onAdd]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleAdd();
    }
  };

  /* ─── Toggle button helper ─── */
  const ToggleBtn = ({
    active,
    onClick,
    children,
    title,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'h-8 w-8 flex items-center justify-center rounded-md text-sm font-medium transition-all',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  );

  /* ─── Dropdown wrapper ─── */
  const Dropdown = ({
    open,
    onToggle,
    label,
    width,
    children,
  }: {
    open: boolean;
    onToggle: () => void;
    label: React.ReactNode;
    width?: string;
    children: React.ReactNode;
  }) => (
    <div className="relative" data-dropdown>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'h-8 flex items-center gap-1 rounded-md border border-input bg-background px-2.5 text-sm transition-colors hover:bg-muted',
          width
        )}
      >
        {label}
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-md shadow-lg py-1 max-h-56 overflow-y-auto min-w-[120px]">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-popover border rounded-xl shadow-2xl w-[480px] max-w-[calc(100vw-16px)] animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95 duration-200"
      style={{ left: position.left, top: position.top }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 className="text-sm font-semibold text-foreground">Add Text</h3>
        <button
          type="button"
          onClick={onClose}
          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Toolbar Row 1: Formatting ── */}
      <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
        {/* Font family dropdown */}
        <Dropdown
          open={fontFamilyOpen}
          onToggle={() => {
            setFontFamilyOpen(!fontFamilyOpen);
            setFontSizeOpen(false);
            setLineHeightOpen(false);
          }}
          label={
            <span className="truncate max-w-[100px] text-xs" style={{ fontFamily }}>
              {fontFamily}
            </span>
          }
          width="min-w-[120px]"
        >
          {fontFamilies.map((ff) => (
            <button
              key={ff}
              type="button"
              onClick={() => {
                setFontFamily(ff);
                setFontFamilyOpen(false);
              }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors',
                fontFamily === ff && 'bg-primary/10 text-primary font-medium'
              )}
              style={{ fontFamily: ff }}
            >
              {ff}
            </button>
          ))}
        </Dropdown>

        {/* Font size dropdown + manual input */}
        <div className="relative" data-dropdown>
          <div className="flex items-center h-8 rounded-md border border-input bg-background overflow-hidden">
            <input
              type="text"
              value={fontSizeInput}
              onChange={(e) => handleFontSizeInputChange(e.target.value)}
              onBlur={() => {
                const num = parseInt(fontSizeInput, 10);
                if (isNaN(num) || num < 1) {
                  setFontSizeInput(String(fontSize));
                } else {
                  setFontSize(Math.min(200, num));
                  setFontSizeInput(String(Math.min(200, num)));
                }
              }}
              className="w-10 h-full px-1.5 text-xs text-center bg-transparent outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setFontSizeOpen(!fontSizeOpen);
                setFontFamilyOpen(false);
                setLineHeightOpen(false);
              }}
              className="h-full px-1 border-l border-input hover:bg-muted transition-colors"
            >
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
          {fontSizeOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-md shadow-lg py-1 max-h-56 overflow-y-auto min-w-[80px]">
              {fontSizePresets.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleFontSizeSelect(size)}
                  className={cn(
                    'w-full text-left px-3 py-1 text-sm hover:bg-muted transition-colors',
                    fontSize === size && 'bg-primary/10 text-primary font-medium'
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Bold / Italic / Underline / Strikethrough */}
        <ToggleBtn active={bold} onClick={() => setBold(!bold)} title="Bold">
          <Bold className="h-4 w-4" />
        </ToggleBtn>
        <ToggleBtn active={italic} onClick={() => setItalic(!italic)} title="Italic">
          <Italic className="h-4 w-4" />
        </ToggleBtn>
        <ToggleBtn active={underline} onClick={() => setUnderline(!underline)} title="Underline">
          <Underline className="h-4 w-4" />
        </ToggleBtn>
        <ToggleBtn active={strikethrough} onClick={() => setStrikethrough(!strikethrough)} title="Strikethrough">
          <Strikethrough className="h-4 w-4" />
        </ToggleBtn>
      </div>

      {/* ── Toolbar Row 2: Style ── */}
      <div className="flex items-center gap-1.5 px-4 pb-3 flex-wrap">
        {/* Color swatches */}
        <div className="flex items-center gap-1">
          {colorSwatches.map((swatch) => (
            <button
              key={swatch.value}
              type="button"
              onClick={() => setColor(swatch.value)}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-all shrink-0',
                color === swatch.value
                  ? 'border-primary scale-110 ring-2 ring-primary/20'
                  : 'border-border hover:border-muted-foreground',
                swatch.value === '#FFFFFF' && 'border-border'
              )}
              style={{ backgroundColor: swatch.value }}
              title={swatch.label}
            />
          ))}
          {/* Custom color toggle */}
          <button
            type="button"
            onClick={() => setShowCustomColor(!showCustomColor)}
            title="Custom color"
            className={cn(
              'h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
              showCustomColor
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-muted-foreground bg-muted'
            )}
          >
            <Palette className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Alignment */}
        <ToggleBtn active={alignment === 'left'} onClick={() => setAlignment('left')} title="Align left">
          <AlignLeft className="h-4 w-4" />
        </ToggleBtn>
        <ToggleBtn active={alignment === 'center'} onClick={() => setAlignment('center')} title="Align center">
          <AlignCenter className="h-4 w-4" />
        </ToggleBtn>
        <ToggleBtn active={alignment === 'right'} onClick={() => setAlignment('right')} title="Align right">
          <AlignRight className="h-4 w-4" />
        </ToggleBtn>

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Line height dropdown */}
        <Dropdown
          open={lineHeightOpen}
          onToggle={() => {
            setLineHeightOpen(!lineHeightOpen);
            setFontFamilyOpen(false);
            setFontSizeOpen(false);
          }}
          label={<span className="text-xs tabular-nums">{lineHeight.toFixed(lineHeight === 1 || lineHeight === 2 ? 1 : 2)}</span>}
        >
          {lineHeightPresets.map((lh) => (
            <button
              key={lh.value}
              type="button"
              onClick={() => {
                setLineHeight(lh.value);
                setLineHeightOpen(false);
              }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors',
                lineHeight === lh.value && 'bg-primary/10 text-primary font-medium'
              )}
            >
              {lh.label}
            </button>
          ))}
        </Dropdown>

        {/* Opacity */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-16 h-1 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
          />
          <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{opacity}%</span>
        </div>
      </div>

      {/* ── Custom color input row ── */}
      {showCustomColor && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <label className="text-xs text-muted-foreground">Hex:</label>
          <input
            type="text"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCustomColorApply();
            }}
            placeholder="#000000"
            maxLength={7}
            className="h-7 w-24 rounded-md border border-input bg-background px-2 text-xs font-mono outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          />
          <div
            className="h-7 w-7 rounded-md border border-border shrink-0"
            style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(customColor.startsWith('#') ? customColor : `#${customColor}`) ? (customColor.startsWith('#') ? customColor : `#${customColor}`) : '#000000' }}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2"
            onClick={handleCustomColorApply}
          >
            Apply
          </Button>
        </div>
      )}

      {/* ── Text input area with live preview ── */}
      <div className="px-4 pb-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your text here..."
          rows={4}
          className="flex w-full rounded-lg border border-input bg-background px-3 py-2.5 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 resize-none transition-shadow"
          style={{
            fontFamily,
            fontSize: `${Math.min(fontSize, 28)}px`,
            fontWeight: bold ? 700 : 400,
            fontStyle: italic ? 'italic' : 'normal',
            textDecoration: [
              underline ? 'underline' : '',
              strikethrough ? 'line-through' : '',
            ]
              .filter(Boolean)
              .join(' ') || 'none',
            color,
            textAlign: alignment,
            lineHeight: lineHeight,
            opacity: opacity / 100,
          }}
        />
      </div>

      {/* ── Action buttons ── */}
      <div className="flex items-center justify-between px-4 pb-3">
        <p className="text-[10px] text-muted-foreground">
          {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter to add
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-8 px-3 text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!text.trim()}
            className="h-8 px-4 text-xs gap-1.5"
          >
            Add to PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
