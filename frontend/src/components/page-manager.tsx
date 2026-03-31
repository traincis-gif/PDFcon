'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  RotateCw,
  MoveHorizontal,
  ArrowLeftToLine,
  ArrowRightToLine,
  FileInput,
  Undo2,
  Redo2,
  CheckSquare,
  Square,
  ZoomOut,
  ZoomIn,
  Loader2,
  GripVertical,
  Save,
  X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface PageEntry {
  /** Unique id for React key and tracking */
  id: string;
  /** Original 1-indexed page number in the source PDF (null for blank/imported) */
  sourcePageNum: number | null;
  /** Source file key — 'primary' for the main file, or a uuid for imported */
  sourceFile: string;
  /** Rotation in degrees (0, 90, 180, 270) */
  rotation: number;
  /** Whether this page is marked as deleted */
  deleted: boolean;
  /** Cached thumbnail data URL */
  thumbnailUrl: string | null;
  /** Whether thumbnail is loading */
  thumbnailLoading: boolean;
  /** Width/height of the original PDF page (for blank pages: A4 default) */
  pageWidth: number;
  pageHeight: number;
}

type OperationRecord =
  | { type: 'delete'; pageIds: string[] }
  | { type: 'undelete'; pageIds: string[] }
  | { type: 'rotate'; pageIds: string[]; angle: number }
  | { type: 'reorder'; fromOrder: string[]; toOrder: string[] }
  | { type: 'duplicate'; newPageId: string; afterIndex: number }
  | { type: 'addBlank'; newPageId: string; atIndex: number }
  | { type: 'import'; newPageIds: string[]; atIndex: number }
  | { type: 'moveBefore'; pageIds: string[]; targetIndex: number; prevOrder: string[] }
  | { type: 'moveAfter'; pageIds: string[]; targetIndex: number; prevOrder: string[] };

interface ImportedFile {
  id: string;
  file: File;
}

// ── Props ──────────────────────────────────────────────────────────────────

interface PageManagerProps {
  file: File;
  onSave: (operations: any[], importedFiles: File[]) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

let _nextId = 0;
function genId(): string {
  return `pm-${Date.now()}-${_nextId++}`;
}

const THUMB_SIZES = [150, 200, 280];
const THUMB_SIZE_LABELS = ['Small', 'Medium', 'Large'];

// A4 in PDF points
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

// ── Component ──────────────────────────────────────────────────────────────

export function PageManager({ file, onSave, onCancel, isProcessing }: PageManagerProps) {
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1); // index into THUMB_SIZES
  const [undoStack, setUndoStack] = useState<OperationRecord[]>([]);
  const [redoStack, setRedoStack] = useState<OperationRecord[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [showMoveDialog, setShowMoveDialog] = useState<'before' | 'after' | null>(null);
  const [moveTargetPage, setMoveTargetPage] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const thumbSize = THUMB_SIZES[zoomLevel];

  // ── Load thumbnails from the primary PDF ────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function loadThumbnails() {
      setLoading(true);
      try {
        const pdfjsLib = await import('pdfjs-dist');
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        const entries: PageEntry[] = [];

        for (let i = 1; i <= totalPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.4 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          const origViewport = page.getViewport({ scale: 1 });

          entries.push({
            id: genId(),
            sourcePageNum: i,
            sourceFile: 'primary',
            rotation: 0,
            deleted: false,
            thumbnailUrl: canvas.toDataURL('image/jpeg', 0.7),
            thumbnailLoading: false,
            pageWidth: origViewport.width,
            pageHeight: origViewport.height,
          });
        }

        if (!cancelled) {
          setPages(entries);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load PDF thumbnails:', err);
        if (!cancelled) setLoading(false);
      }
    }

    loadThumbnails();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // ── Derived state ───────────────────────────────────────────────────────

  const visiblePages = useMemo(() => pages.filter((p) => !p.deleted), [pages]);
  const selectedCount = selectedIds.size;

  const changeCount = useMemo(() => {
    let count = 0;
    count += pages.filter((p) => p.deleted).length; // deletions
    count += pages.filter((p) => p.rotation !== 0).length; // rotations
    count += pages.filter((p) => p.sourceFile !== 'primary').length; // imports + blanks
    count += pages.filter((p) => p.sourceFile === 'primary' && p.sourcePageNum !== null).length > 0
      ? (() => {
          // check if order changed
          const origOrder = pages
            .filter((p) => p.sourceFile === 'primary' && p.sourcePageNum !== null && !p.deleted)
            .map((p) => p.sourcePageNum);
          let reordered = false;
          let prev = 0;
          for (const n of origOrder) {
            if (n !== null && n <= prev) {
              reordered = true;
              break;
            }
            prev = n ?? 0;
          }
          return reordered ? 1 : 0;
        })()
      : 0;
    // Check for duplicates
    const seenSourcePages = new Map<string, number>();
    for (const p of pages) {
      if (p.sourceFile === 'primary' && p.sourcePageNum !== null && !p.deleted) {
        const key = `${p.sourceFile}:${p.sourcePageNum}`;
        seenSourcePages.set(key, (seenSourcePages.get(key) || 0) + 1);
      }
    }
    for (const [, c] of seenSourcePages) {
      if (c > 1) count += c - 1;
    }
    return count;
  }, [pages]);

  // ── Undo/Redo helpers ───────────────────────────────────────────────────

  const pushUndo = useCallback((op: OperationRecord) => {
    setUndoStack((prev) => [...prev, op]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prevStack) => {
      if (prevStack.length === 0) return prevStack;
      const op = prevStack[prevStack.length - 1];
      const newStack = prevStack.slice(0, -1);

      setPages((prev) => {
        switch (op.type) {
          case 'delete':
            return prev.map((p) => (op.pageIds.includes(p.id) ? { ...p, deleted: false } : p));
          case 'undelete':
            return prev.map((p) => (op.pageIds.includes(p.id) ? { ...p, deleted: true } : p));
          case 'rotate':
            return prev.map((p) =>
              op.pageIds.includes(p.id)
                ? { ...p, rotation: ((p.rotation - op.angle) % 360 + 360) % 360 }
                : p
            );
          case 'reorder':
          case 'moveBefore':
          case 'moveAfter': {
            const fromOrder = 'fromOrder' in op ? op.fromOrder : op.prevOrder;
            const orderMap = new Map(fromOrder.map((id, i) => [id, i]));
            return [...prev].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
          }
          case 'duplicate':
          case 'addBlank':
            return prev.filter((p) => p.id !== ('newPageId' in op ? op.newPageId : ''));
          case 'import':
            return prev.filter((p) => !op.newPageIds.includes(p.id));
          default:
            return prev;
        }
      });

      setRedoStack((prevRedo) => [...prevRedo, op]);
      return newStack;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prevStack) => {
      if (prevStack.length === 0) return prevStack;
      const op = prevStack[prevStack.length - 1];
      const newStack = prevStack.slice(0, -1);

      setPages((prev) => {
        switch (op.type) {
          case 'delete':
            return prev.map((p) => (op.pageIds.includes(p.id) ? { ...p, deleted: true } : p));
          case 'undelete':
            return prev.map((p) => (op.pageIds.includes(p.id) ? { ...p, deleted: false } : p));
          case 'rotate':
            return prev.map((p) =>
              op.pageIds.includes(p.id)
                ? { ...p, rotation: (p.rotation + op.angle) % 360 }
                : p
            );
          case 'reorder': {
            const orderMap = new Map(op.toOrder.map((id, i) => [id, i]));
            return [...prev].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
          }
          case 'moveBefore':
          case 'moveAfter':
            // For move ops, re-apply is complex; just rely on pushing new undo entries
            return prev;
          case 'duplicate':
          case 'addBlank':
          case 'import':
            // Re-apply would need stored page data; skipping redo for these
            return prev;
          default:
            return prev;
        }
      });

      setUndoStack((prevUndo) => [...prevUndo, op]);
      return newStack;
    });
  }, []);

  // ── Selection ───────────────────────────────────────────────────────────

  const handlePageClick = useCallback(
    (pageId: string, event: React.MouseEvent) => {
      const visibleIds = pages.filter((p) => !p.deleted).map((p) => p.id);

      if (event.shiftKey && lastClickedId) {
        // Range select
        const startIdx = visibleIds.indexOf(lastClickedId);
        const endIdx = visibleIds.indexOf(pageId);
        if (startIdx !== -1 && endIdx !== -1) {
          const min = Math.min(startIdx, endIdx);
          const max = Math.max(startIdx, endIdx);
          const rangeIds = visibleIds.slice(min, max + 1);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            rangeIds.forEach((id) => next.add(id));
            return next;
          });
        }
      } else if (event.ctrlKey || event.metaKey) {
        // Toggle single
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(pageId)) {
            next.delete(pageId);
          } else {
            next.add(pageId);
          }
          return next;
        });
      } else {
        // Single select
        setSelectedIds((prev) => {
          if (prev.size === 1 && prev.has(pageId)) {
            return new Set();
          }
          return new Set([pageId]);
        });
      }
      setLastClickedId(pageId);
    },
    [pages, lastClickedId]
  );

  const handleSelectAll = useCallback(() => {
    const allVisible = pages.filter((p) => !p.deleted).map((p) => p.id);
    setSelectedIds(new Set(allVisible));
  }, [pages]);

  const handleSelectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ── Delete ──────────────────────────────────────────────────────────────

  const handleDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    pushUndo({ type: 'delete', pageIds: ids });
    setPages((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, deleted: true } : p)));
    setSelectedIds(new Set());
  }, [selectedIds, pushUndo]);

  // ── Duplicate ───────────────────────────────────────────────────────────

  const handleDuplicate = useCallback(() => {
    if (selectedIds.size !== 1) return;
    const srcId = Array.from(selectedIds)[0];
    const srcIdx = pages.findIndex((p) => p.id === srcId);
    if (srcIdx === -1) return;

    const src = pages[srcIdx];
    const newPage: PageEntry = {
      ...src,
      id: genId(),
      rotation: 0,
      deleted: false,
    };

    pushUndo({ type: 'duplicate', newPageId: newPage.id, afterIndex: srcIdx });
    setPages((prev) => {
      const next = [...prev];
      next.splice(srcIdx + 1, 0, newPage);
      return next;
    });
    setSelectedIds(new Set([newPage.id]));
  }, [selectedIds, pages, pushUndo]);

  // ── Rotate ──────────────────────────────────────────────────────────────

  const handleRotate = useCallback(
    (angle: number) => {
      if (selectedIds.size === 0) return;
      const ids = Array.from(selectedIds);
      pushUndo({ type: 'rotate', pageIds: ids, angle });
      setPages((prev) =>
        prev.map((p) =>
          ids.includes(p.id) ? { ...p, rotation: ((p.rotation + angle) % 360 + 360) % 360 } : p
        )
      );
    },
    [selectedIds, pushUndo]
  );

  // ── Drag-and-drop reorder ──────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      if (e.currentTarget instanceof HTMLElement) {
        requestAnimationFrame(() => {
          (e.currentTarget as HTMLElement).style.opacity = '0.4';
        });
      }
    },
    []
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const handleDragOver = useCallback((_e: React.DragEvent, index: number) => {
    _e.preventDefault();
    _e.dataTransfer.dropEffect = 'move';
    setOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      const sourceIndex = dragIndex;
      if (sourceIndex === null || sourceIndex === targetIndex) {
        setDragIndex(null);
        setOverIndex(null);
        return;
      }

      // We work with all pages (not just visible), but map through visible indices
      const visibleIdsBefore = pages.filter((p) => !p.deleted).map((p) => p.id);
      const fromOrder = pages.map((p) => p.id);

      setPages((prev) => {
        // Build visible list
        const visible = prev.filter((p) => !p.deleted);
        const hidden = prev.filter((p) => p.deleted);

        const [moved] = visible.splice(sourceIndex, 1);
        visible.splice(targetIndex, 0, moved);

        // Reconstruct full list: visible in new order, then hidden at the end
        return [...visible, ...hidden];
      });

      setPages((current) => {
        const toOrder = current.map((p) => p.id);
        pushUndo({ type: 'reorder', fromOrder, toOrder });
        return current;
      });

      setDragIndex(null);
      setOverIndex(null);
    },
    [dragIndex, pages, pushUndo]
  );

  // ── Move Before/After ──────────────────────────────────────────────────

  const handleMoveTo = useCallback(
    (mode: 'before' | 'after') => {
      const targetPageNum = parseInt(moveTargetPage, 10);
      if (isNaN(targetPageNum) || selectedIds.size === 0) return;

      const visible = pages.filter((p) => !p.deleted);
      const targetIdx = targetPageNum - 1;
      if (targetIdx < 0 || targetIdx >= visible.length) return;

      const prevOrder = pages.map((p) => p.id);
      const ids = Array.from(selectedIds);

      setPages((prev) => {
        const vis = prev.filter((p) => !p.deleted);
        const hidden = prev.filter((p) => p.deleted);

        // Remove selected from visible list
        const remaining = vis.filter((p) => !ids.includes(p.id));
        const moved = vis.filter((p) => ids.includes(p.id));

        // Find target in remaining
        let insertIdx = remaining.findIndex((p) => p.id === visible[targetIdx]?.id);
        if (insertIdx === -1) insertIdx = remaining.length;
        if (mode === 'after') insertIdx += 1;

        remaining.splice(insertIdx, 0, ...moved);
        return [...remaining, ...hidden];
      });

      pushUndo({ type: mode === 'before' ? 'moveBefore' : 'moveAfter', pageIds: ids, targetIndex: targetIdx, prevOrder });
      setShowMoveDialog(null);
      setMoveTargetPage('');
    },
    [moveTargetPage, selectedIds, pages, pushUndo]
  );

  // ── Import Document ────────────────────────────────────────────────────

  const handleImportFile = useCallback(
    async (importFile: File) => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        }

        const arrayBuffer = await importFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        const importId = genId();
        const newEntries: PageEntry[] = [];

        for (let i = 1; i <= totalPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.4 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          const origViewport = page.getViewport({ scale: 1 });

          newEntries.push({
            id: genId(),
            sourcePageNum: i,
            sourceFile: importId,
            rotation: 0,
            deleted: false,
            thumbnailUrl: canvas.toDataURL('image/jpeg', 0.7),
            thumbnailLoading: false,
            pageWidth: origViewport.width,
            pageHeight: origViewport.height,
          });
        }

        setImportedFiles((prev) => [...prev, { id: importId, file: importFile }]);

        // Insert after last selected, or at the end
        const visible = pages.filter((p) => !p.deleted);
        let insertIndex = visible.length;
        if (selectedIds.size > 0) {
          const lastSelectedIdx = visible.reduce((acc, p, i) => (selectedIds.has(p.id) ? i : acc), -1);
          if (lastSelectedIdx !== -1) insertIndex = lastSelectedIdx + 1;
        }

        const newPageIds = newEntries.map((e) => e.id);
        pushUndo({ type: 'import', newPageIds, atIndex: insertIndex });

        setPages((prev) => {
          const vis = prev.filter((p) => !p.deleted);
          const hidden = prev.filter((p) => p.deleted);
          vis.splice(insertIndex, 0, ...newEntries);
          return [...vis, ...hidden];
        });

        setSelectedIds(new Set(newPageIds));
      } catch (err) {
        console.error('Failed to import PDF:', err);
      }
    },
    [pages, selectedIds, pushUndo]
  );

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) {
        handleImportFile(f);
      }
      e.target.value = '';
    },
    [handleImportFile]
  );

  // ── New Blank Page ─────────────────────────────────────────────────────

  const handleNewPage = useCallback(() => {
    const newPage: PageEntry = {
      id: genId(),
      sourcePageNum: null,
      sourceFile: 'blank',
      rotation: 0,
      deleted: false,
      thumbnailUrl: null,
      thumbnailLoading: false,
      pageWidth: A4_WIDTH,
      pageHeight: A4_HEIGHT,
    };

    const visible = pages.filter((p) => !p.deleted);
    let insertIndex = visible.length;
    if (selectedIds.size > 0) {
      const lastSelectedIdx = visible.reduce((acc, p, i) => (selectedIds.has(p.id) ? i : acc), -1);
      if (lastSelectedIdx !== -1) insertIndex = lastSelectedIdx + 1;
    }

    pushUndo({ type: 'addBlank', newPageId: newPage.id, atIndex: insertIndex });

    setPages((prev) => {
      const vis = prev.filter((p) => !p.deleted);
      const hidden = prev.filter((p) => p.deleted);
      vis.splice(insertIndex, 0, newPage);
      return [...vis, ...hidden];
    });

    setSelectedIds(new Set([newPage.id]));
  }, [pages, selectedIds, pushUndo]);

  // ── Zoom ────────────────────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 1, THUMB_SIZES.length - 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 1, 0));
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        handleSelectAll();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          handleDelete();
        }
      } else if (e.key === 'Escape') {
        handleSelectNone();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleSelectAll, handleSelectNone, handleDelete, selectedIds]);

  // ── Save ────────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    // Build operations array from current state
    const operations: any[] = [];
    const visible = pages.filter((p) => !p.deleted);

    // 1. Deletions (original pages that are deleted)
    const deletedPages = pages
      .filter((p) => p.deleted && p.sourceFile === 'primary' && p.sourcePageNum !== null)
      .map((p) => p.sourcePageNum!);
    if (deletedPages.length > 0) {
      operations.push({ type: 'delete', pages: deletedPages });
    }

    // 2. Rotations
    const rotatedPages = visible.filter((p) => p.rotation !== 0 && p.sourceFile === 'primary');
    const rotationGroups = new Map<number, number[]>();
    for (const p of rotatedPages) {
      const existing = rotationGroups.get(p.rotation) || [];
      existing.push(p.sourcePageNum!);
      rotationGroups.set(p.rotation, existing);
    }
    for (const [angle, pageNums] of rotationGroups) {
      operations.push({ type: 'rotate', pages: pageNums, angle });
    }

    // 3. Reorder — build the final page order
    const pageOrder = visible
      .filter((p) => p.sourceFile === 'primary' && p.sourcePageNum !== null)
      .map((p) => p.sourcePageNum!);
    const isReordered = pageOrder.some((num, i) => {
      // Check if order differs from sequential
      if (i === 0) return false;
      return num <= pageOrder[i - 1];
    });
    if (isReordered || deletedPages.length > 0) {
      operations.push({ type: 'reorder', pageOrder });
    }

    // 4. Duplicates — pages from primary that appear more than once
    const primaryPageCounts = new Map<number, number>();
    for (const p of visible) {
      if (p.sourceFile === 'primary' && p.sourcePageNum !== null) {
        primaryPageCounts.set(p.sourcePageNum, (primaryPageCounts.get(p.sourcePageNum) || 0) + 1);
      }
    }
    for (const p of visible) {
      if (p.sourceFile === 'primary' && p.sourcePageNum !== null) {
        const count = primaryPageCounts.get(p.sourcePageNum) || 0;
        if (count > 1) {
          // Find position in visible
          const visIdx = visible.indexOf(p);
          operations.push({ type: 'duplicate', sourcePage: p.sourcePageNum, insertAfter: visIdx });
          primaryPageCounts.set(p.sourcePageNum, count - 1);
        }
      }
    }

    // 5. Blank pages
    for (let i = 0; i < visible.length; i++) {
      const p = visible[i];
      if (p.sourceFile === 'blank') {
        operations.push({
          type: 'addBlank',
          insertAt: i + 1,
          width: p.pageWidth,
          height: p.pageHeight,
        });
      }
    }

    // 6. Imported pages
    const importGroups = new Map<string, { pages: number[]; insertAt: number }>();
    for (let i = 0; i < visible.length; i++) {
      const p = visible[i];
      if (p.sourceFile !== 'primary' && p.sourceFile !== 'blank' && p.sourcePageNum !== null) {
        const existing = importGroups.get(p.sourceFile);
        if (existing) {
          existing.pages.push(p.sourcePageNum);
        } else {
          importGroups.set(p.sourceFile, { pages: [p.sourcePageNum], insertAt: i + 1 });
        }
      }
    }
    for (const [fileId, { pages: importPages, insertAt }] of importGroups) {
      operations.push({ type: 'import', fileId, pages: importPages, insertAt });
    }

    const importFilesList = importedFiles.map((f) => f.file);
    onSave(operations, importFilesList);
  }, [pages, importedFiles, onSave]);

  // ── Toolbar button helper ──────────────────────────────────────────────

  function ToolButton({
    icon: Icon,
    label,
    onClick,
    disabled = false,
    variant = 'default',
  }: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'default' | 'danger';
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'min-w-[52px]',
          disabled
            ? 'opacity-40 cursor-not-allowed'
            : variant === 'danger'
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        )}
        title={label}
      >
        <Icon className="h-4 w-4" />
        <span className="leading-tight whitespace-nowrap">{label}</span>
      </button>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading page thumbnails...</p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full">
        <p className="text-sm text-muted-foreground">No pages found in this PDF.</p>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Top Toolbar ──────────────────────────────────────────────── */}
      <div className="border-b bg-background/95 backdrop-blur shrink-0 overflow-x-auto">
        <div className="flex items-center gap-0.5 px-2 py-1 min-w-max">
          {/* Page operations */}
          <ToolButton icon={Plus} label="New Page" onClick={handleNewPage} />
          <ToolButton
            icon={Trash2}
            label="Delete"
            onClick={handleDelete}
            disabled={selectedCount === 0}
            variant="danger"
          />
          <ToolButton
            icon={Copy}
            label="Duplicate"
            onClick={handleDuplicate}
            disabled={selectedCount !== 1}
          />
          <ToolButton
            icon={RotateCcw}
            label="Rotate Left"
            onClick={() => handleRotate(-90)}
            disabled={selectedCount === 0}
          />
          <ToolButton
            icon={RotateCw}
            label="Rotate Right"
            onClick={() => handleRotate(90)}
            disabled={selectedCount === 0}
          />

          <div className="w-px h-6 bg-border mx-1 shrink-0" />

          {/* Move operations */}
          <ToolButton
            icon={MoveHorizontal}
            label="Drag to Move"
            onClick={() => {}}
            disabled
          />
          <ToolButton
            icon={ArrowLeftToLine}
            label="Move Before"
            onClick={() => { setShowMoveDialog('before'); setMoveTargetPage(''); }}
            disabled={selectedCount === 0}
          />
          <ToolButton
            icon={ArrowRightToLine}
            label="Move After"
            onClick={() => { setShowMoveDialog('after'); setMoveTargetPage(''); }}
            disabled={selectedCount === 0}
          />
          <ToolButton icon={FileInput} label="Import PDF" onClick={handleImportClick} />

          <div className="w-px h-6 bg-border mx-1 shrink-0" />

          {/* Undo/Redo */}
          <ToolButton
            icon={Undo2}
            label="Undo"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
          />
          <ToolButton
            icon={Redo2}
            label="Redo"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
          />

          <div className="w-px h-6 bg-border mx-1 shrink-0" />

          {/* Selection */}
          <ToolButton icon={CheckSquare} label="Select All" onClick={handleSelectAll} />
          <ToolButton icon={Square} label="Select None" onClick={handleSelectNone} />

          <div className="w-px h-6 bg-border mx-1 shrink-0" />

          {/* Zoom */}
          <ToolButton
            icon={ZoomOut}
            label="Zoom Out"
            onClick={handleZoomOut}
            disabled={zoomLevel === 0}
          />
          <span className="text-[10px] font-medium text-muted-foreground px-1 tabular-nums">
            {THUMB_SIZE_LABELS[zoomLevel]}
          </span>
          <ToolButton
            icon={ZoomIn}
            label="Zoom In"
            onClick={handleZoomIn}
            disabled={zoomLevel === THUMB_SIZES.length - 1}
          />
        </div>
      </div>

      {/* ── Move Before/After Dialog ─────────────────────────────────── */}
      {showMoveDialog && (
        <div className="border-b bg-muted/50 px-4 py-2 flex items-center gap-3 shrink-0">
          <span className="text-sm font-medium">
            Move {selectedCount} page{selectedCount > 1 ? 's' : ''}{' '}
            {showMoveDialog === 'before' ? 'before' : 'after'} page:
          </span>
          <input
            type="number"
            min={1}
            max={visiblePages.length}
            value={moveTargetPage}
            onChange={(e) => setMoveTargetPage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleMoveTo(showMoveDialog);
              if (e.key === 'Escape') setShowMoveDialog(null);
            }}
            className="w-20 rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="#"
            autoFocus
          />
          <Button size="sm" onClick={() => handleMoveTo(showMoveDialog)} disabled={!moveTargetPage}>
            Move
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowMoveDialog(null)}>
            Cancel
          </Button>
        </div>
      )}

      {/* ── Page Grid ────────────────────────────────────────────────── */}
      <div ref={gridRef} className="flex-1 overflow-y-auto p-4 bg-muted/30">
        <div
          className="grid gap-4 mx-auto"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize + 16}px, 1fr))`,
            maxWidth: '1400px',
          }}
        >
          {visiblePages.map((page, index) => {
            const isSelected = selectedIds.has(page.id);
            const isDeleted = page.deleted;
            const isDragOver = overIndex === index && dragIndex !== index;
            const isDragging = dragIndex === index;

            return (
              <div
                key={page.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onClick={(e) => handlePageClick(page.id, e)}
                className={cn(
                  'relative group cursor-pointer select-none',
                  'rounded-lg overflow-hidden transition-all duration-150',
                  'border-2',
                  isSelected
                    ? 'border-red-500 shadow-lg shadow-red-500/20 ring-1 ring-red-500/30'
                    : isDragOver
                      ? 'border-primary shadow-lg scale-[1.02] bg-primary/5'
                      : 'border-border hover:shadow-md hover:border-muted-foreground/30',
                  isDragging && 'opacity-40',
                  isDeleted && 'opacity-30',
                  'bg-card'
                )}
              >
                {/* Drag handle */}
                <div className="absolute top-1 left-1 z-10 opacity-0 group-hover:opacity-60 transition-opacity">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Selection checkmark */}
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 z-10">
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Thumbnail */}
                <div
                  className="flex items-center justify-center overflow-hidden bg-white"
                  style={{
                    width: `${thumbSize}px`,
                    height: `${Math.round(thumbSize * 1.414)}px`,
                    margin: '0 auto',
                  }}
                >
                  {page.thumbnailUrl ? (
                    <img
                      src={page.thumbnailUrl}
                      alt={`Page ${index + 1}`}
                      className="max-w-full max-h-full object-contain transition-transform duration-150"
                      style={{
                        transform: `rotate(${page.rotation}deg)`,
                      }}
                      draggable={false}
                    />
                  ) : page.sourceFile === 'blank' ? (
                    <div className="w-full h-full flex items-center justify-center bg-white border border-dashed border-muted-foreground/30">
                      <span className="text-xs text-muted-foreground">Blank Page</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Page number badge */}
                <div className="flex items-center justify-center py-1.5 border-t bg-background">
                  <span
                    className={cn(
                      'inline-flex items-center justify-center rounded-full text-xs font-medium tabular-nums',
                      'w-6 h-6',
                      isSelected
                        ? 'bg-red-500 text-white'
                        : 'bg-muted text-muted-foreground',
                      isDeleted && 'line-through'
                    )}
                  >
                    {index + 1}
                  </span>
                  {page.sourceFile !== 'primary' && page.sourceFile !== 'blank' && (
                    <span className="ml-1.5 text-[9px] text-blue-500 font-medium">IMP</span>
                  )}
                  {page.sourceFile === 'blank' && (
                    <span className="ml-1.5 text-[9px] text-green-600 font-medium">NEW</span>
                  )}
                  {page.rotation !== 0 && (
                    <span className="ml-1.5 text-[9px] text-orange-500 font-medium">
                      {page.rotation}&deg;
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom Bar ───────────────────────────────────────────────── */}
      <div className="border-t bg-background/95 backdrop-blur shrink-0 px-4 py-2.5 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1.5">
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>

        <span className="text-sm text-muted-foreground">
          {selectedCount > 0 ? (
            <span className="font-medium text-foreground">
              {selectedCount} page{selectedCount > 1 ? 's' : ''} selected
            </span>
          ) : (
            <span>{visiblePages.length} pages total</span>
          )}
        </span>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={changeCount === 0 || isProcessing}
          className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              Save{changeCount > 0 ? ` (${changeCount} change${changeCount > 1 ? 's' : ''})` : ''}
            </>
          )}
        </Button>
      </div>

      {/* Hidden import input */}
      <input
        ref={importInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleImportInputChange}
      />
    </div>
  );
}
