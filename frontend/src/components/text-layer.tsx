'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { TextEdit } from '@/types';

// We dynamically import pdfjs-dist (same as pdf-viewer.tsx)
let pdfjsLib: typeof import('pdfjs-dist') | null = null;
let pdfjsLoaded = false;

interface TextItem {
  str: string;
  transform: number[]; // [scaleX, skewX, skewY, scaleY, translateX, translateY]
  width: number;
  height: number;
  fontName: string;
}

/** A grouped line of text items that share the same baseline */
interface TextLine {
  items: TextItem[];
  text: string;
  x: number;       // PDF x (leftmost item)
  y: number;       // PDF y (baseline, from bottom)
  width: number;   // total width in PDF units
  height: number;  // font size / height in PDF units
  fontSize: number;
}

interface TextLayerProps {
  file: File;
  pageNumber: number; // 1-indexed
  scale: number;
  pageHeight: number;
  editable: boolean;
  onTextEdited: (edit: TextEdit) => void;
  editedTexts: TextEdit[]; // already-edited texts for this page to show indicators
}

/** Group text items into lines based on shared baseline */
function groupIntoLines(items: TextItem[]): TextLine[] {
  if (items.length === 0) return [];

  // Sort by Y descending (top of page first), then X ascending
  const sorted = [...items].sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5];
    if (Math.abs(yDiff) > 2) return yDiff;
    return a.transform[4] - b.transform[4];
  });

  const lines: TextLine[] = [];
  let currentLine: TextItem[] = [sorted[0]];
  let currentY = sorted[0].transform[5];

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const itemY = item.transform[5];

    // Same baseline if within 2pt tolerance
    if (Math.abs(itemY - currentY) <= 2) {
      currentLine.push(item);
    } else {
      // Finalize current line
      lines.push(buildLine(currentLine));
      currentLine = [item];
      currentY = itemY;
    }
  }
  if (currentLine.length > 0) {
    lines.push(buildLine(currentLine));
  }

  return lines;
}

function buildLine(items: TextItem[]): TextLine {
  // Sort items left-to-right
  items.sort((a, b) => a.transform[4] - b.transform[4]);

  // Merge text, inserting spaces between items that have gaps
  let text = '';
  for (let i = 0; i < items.length; i++) {
    if (i > 0) {
      const prevEnd = items[i - 1].transform[4] + items[i - 1].width;
      const currStart = items[i].transform[4];
      const gap = currStart - prevEnd;
      const spaceWidth = items[i].height * 0.3; // approximate space width
      if (gap > spaceWidth) {
        text += ' ';
      }
    }
    text += items[i].str;
  }

  const firstItem = items[0];
  const lastItem = items[items.length - 1];
  const x = firstItem.transform[4];
  const y = firstItem.transform[5];
  const width = (lastItem.transform[4] + lastItem.width) - x;
  const height = Math.max(...items.map(it => it.height));
  const fontSize = height;

  return { items, text, x, y, width, height, fontSize };
}

export function TextLayer({
  file,
  pageNumber,
  scale,
  pageHeight,
  editable,
  onTextEdited,
  editedTexts,
}: TextLayerProps) {
  const [lines, setLines] = useState<TextLine[]>([]);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const editableRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const originalTexts = useRef<Map<number, string>>(new Map());

  // Load text content from the PDF page
  useEffect(() => {
    let cancelled = false;

    async function loadTextContent() {
      // Ensure pdfjs is loaded
      if (!pdfjsLoaded) {
        const lib = await import('pdfjs-dist');
        const pdfjsVersion = lib.version;
        lib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`;
        pdfjsLib = lib;
        pdfjsLoaded = true;
      }
      if (!pdfjsLib || cancelled) return;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        if (cancelled) return;

        const page = await doc.getPage(pageNumber);
        if (cancelled) return;

        const textContent = await page.getTextContent();
        if (cancelled) return;

        // Filter and map text items
        const textItems: TextItem[] = [];
        for (const item of textContent.items) {
          // pdfjs TextItem has str, transform, width, height, fontName
          const ti = item as any;
          if (ti.str && ti.str.trim().length > 0 && ti.width > 0) {
            textItems.push({
              str: ti.str,
              transform: ti.transform,
              width: ti.width,
              height: ti.height || Math.abs(ti.transform[3]),
              fontName: ti.fontName || '',
            });
          }
        }

        const grouped = groupIntoLines(textItems);
        if (!cancelled) {
          setLines(grouped);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('TextLayer: Failed to load text content', err);
          setLoading(false);
        }
      }
    }

    setLoading(true);
    setLines([]);
    setActiveLineIndex(null);
    loadTextContent();

    return () => {
      cancelled = true;
    };
  }, [file, pageNumber]);

  // Activate a text line for editing (shared by click and touch)
  const activateLine = useCallback(
    (index: number) => {
      if (!editable) return;

      setActiveLineIndex(index);
      const line = lines[index];
      originalTexts.current.set(index, line.text);

      // Focus the div after render
      requestAnimationFrame(() => {
        const el = editableRefs.current.get(index);
        if (el) {
          el.focus();
          // Place cursor at end
          const selection = window.getSelection();
          if (selection && el.firstChild) {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      });
    },
    [editable, lines]
  );

  // Handle clicking on a text line to make it editable
  const handleLineClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      if (!editable) return;
      e.stopPropagation();
      e.preventDefault();
      activateLine(index);
    },
    [editable, activateLine]
  );

  // Handle touch on a text line for mobile editing
  const handleLineTouchEnd = useCallback(
    (index: number, e: React.TouchEvent) => {
      if (!editable) return;
      e.stopPropagation();
      // Prevent the mouse event from also firing
      e.preventDefault();
      activateLine(index);
    },
    [editable, activateLine]
  );

  // Handle blur (finish editing)
  const handleBlur = useCallback(
    (index: number) => {
      const el = editableRefs.current.get(index);
      if (!el) return;

      const newText = el.textContent || '';
      const original = originalTexts.current.get(index) || lines[index]?.text || '';

      if (newText !== original && newText.trim().length > 0) {
        const line = lines[index];
        onTextEdited({
          page: pageNumber - 1, // 0-indexed
          originalText: original,
          newText: newText,
          x: line.x,
          y: line.y,
          width: line.width,
          height: line.height,
          fontSize: line.fontSize,
        });
      }

      setActiveLineIndex(null);
    },
    [lines, pageNumber, onTextEdited]
  );

  // Handle keydown in editable div
  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const el = editableRefs.current.get(index);
        if (el) el.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        // Restore original text
        const el = editableRefs.current.get(index);
        const original = originalTexts.current.get(index);
        if (el && original !== undefined) {
          el.textContent = original;
        }
        setActiveLineIndex(null);
      }
      // Ctrl+S / Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const el = editableRefs.current.get(index);
        if (el) el.blur();
      }
    },
    []
  );

  // Check if a line has been edited already
  const isLineEdited = useCallback(
    (line: TextLine): boolean => {
      return editedTexts.some(
        (edit) =>
          Math.abs(edit.x - line.x) < 1 &&
          Math.abs(edit.y - line.y) < 1 &&
          edit.originalText === line.text
      );
    },
    [editedTexts]
  );

  // Get the edited text for a line if it was already edited
  const getEditedText = useCallback(
    (line: TextLine): string | null => {
      const edit = editedTexts.find(
        (edit) =>
          Math.abs(edit.x - line.x) < 1 &&
          Math.abs(edit.y - line.y) < 1 &&
          edit.originalText === line.text
      );
      return edit ? edit.newText : null;
    },
    [editedTexts]
  );

  if (loading || !editable) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-[8]"
      style={{ pointerEvents: editable ? 'auto' : 'none' }}
    >
      {lines.map((line, index) => {
        const isActive = activeLineIndex === index;
        const edited = isLineEdited(line);
        const editedText = getEditedText(line);

        // Convert PDF coordinates to CSS coordinates
        // PDF: origin bottom-left, CSS: origin top-left
        const left = line.x * scale;
        const top = (pageHeight - line.y - line.height) * scale;
        const width = line.width * scale;
        const height = line.height * scale;
        const fontSize = line.fontSize * scale;

        // Pad the clickable area slightly
        const padding = 2;

        return (
          <div
            key={`${index}-${line.x}-${line.y}`}
            ref={(el) => {
              if (el) {
                editableRefs.current.set(index, el);
              } else {
                editableRefs.current.delete(index);
              }
            }}
            contentEditable={isActive}
            suppressContentEditableWarning
            onClick={(e) => handleLineClick(index, e)}
            onTouchEnd={(e) => handleLineTouchEnd(index, e)}
            onBlur={() => handleBlur(index)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className={[
              'absolute whitespace-pre leading-none',
              editable && !isActive
                ? 'cursor-text hover:outline-dotted hover:outline-1 hover:outline-blue-400/60'
                : '',
              isActive
                ? 'outline-none bg-blue-50/90 ring-2 ring-blue-400/70 rounded-[1px] z-20'
                : '',
              edited && !isActive
                ? 'bg-orange-50/60'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              left: `${left - padding}px`,
              top: `${top - padding}px`,
              minWidth: `${width + padding * 2}px`,
              minHeight: `${height + padding * 2}px`,
              padding: `${padding}px`,
              fontSize: `${fontSize}px`,
              lineHeight: `${height}px`,
              fontFamily: 'sans-serif',
              // When not active, text is transparent so the canvas shows through
              // When active, show the text for editing
              color: isActive ? '#000' : 'transparent',
              // Make the background transparent when not active and not edited
              caretColor: isActive ? '#2563EB' : 'transparent',
              // Safari contenteditable compatibility
              WebkitUserModify: isActive ? 'read-write-plaintext-only' : 'read-only',
              wordBreak: 'keep-all',
              overflowWrap: 'normal',
              boxSizing: 'border-box',
            }}
          >
            {editedText || line.text}
            {/* Modified indicator dot */}
            {edited && !isActive && (
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full border border-white pointer-events-none"
                style={{ zIndex: 30 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
