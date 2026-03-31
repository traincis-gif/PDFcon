import { PDFDocument, degrees } from "pdf-lib";

export interface PageOperation {
  type: "delete" | "rotate" | "reorder" | "duplicate" | "addBlank" | "import";
  pages?: number[];
  angle?: number;
  pageOrder?: number[];
  sourcePage?: number;
  insertAfter?: number;
  insertAt?: number;
  width?: number;
  height?: number;
  fileId?: string;
}

export interface ManagePagesOptions {
  inputBuffer: Buffer;
  operations: PageOperation[];
  importBuffers?: Map<string, Buffer>; // fileId -> buffer for imported PDFs
}

/**
 * Apply a sequence of page management operations to a PDF.
 *
 * Operations are applied in a specific order to maintain consistency:
 * 1. Import pages (merge external pages at specified positions)
 * 2. Add blank pages
 * 3. Duplicate pages
 * 4. Delete pages
 * 5. Rotate pages
 * 6. Reorder remaining pages
 *
 * However, to simplify things, we build the final document in one pass
 * by constructing a "virtual page list" from all operations, then
 * assembling the output.
 */
export async function managePdfPages(
  options: ManagePagesOptions
): Promise<{ resultBuffer: Buffer; pageCount: number }> {
  const { inputBuffer, operations, importBuffers } = options;

  const sourceDoc = await PDFDocument.load(inputBuffer, { ignoreEncryption: true });
  const sourcePageCount = sourceDoc.getPageCount();

  // Build a virtual page list that represents the final document.
  // Each entry is: { source, pageNum, rotation, width, height }
  // source is either 'primary', 'blank', or a fileId string.

  interface VirtualPage {
    source: string;
    pageNum: number; // 1-indexed, 0 for blank
    rotation: number;
    width: number;
    height: number;
  }

  // Start with all primary pages
  let virtualPages: VirtualPage[] = [];
  for (let i = 1; i <= sourcePageCount; i++) {
    const page = sourceDoc.getPage(i - 1);
    const { width, height } = page.getSize();
    virtualPages.push({
      source: "primary",
      pageNum: i,
      rotation: 0,
      width,
      height,
    });
  }

  // Apply operations in the order they appear
  for (const op of operations) {
    switch (op.type) {
      case "delete": {
        if (op.pages && op.pages.length > 0) {
          const deleteSet = new Set(op.pages);
          virtualPages = virtualPages.filter(
            (vp) => !(vp.source === "primary" && deleteSet.has(vp.pageNum))
          );
        }
        break;
      }

      case "rotate": {
        if (op.pages && op.angle) {
          const rotateSet = new Set(op.pages);
          const angle = op.angle;
          virtualPages = virtualPages.map((vp) => {
            if (vp.source === "primary" && rotateSet.has(vp.pageNum)) {
              return {
                ...vp,
                rotation: ((vp.rotation + angle) % 360 + 360) % 360,
              };
            }
            return vp;
          });
        }
        break;
      }

      case "reorder": {
        if (op.pageOrder && op.pageOrder.length > 0) {
          // Build a map from pageNum to virtual page for primary pages
          const primaryMap = new Map<number, VirtualPage>();
          const nonPrimary: VirtualPage[] = [];

          for (const vp of virtualPages) {
            if (vp.source === "primary" && vp.pageNum > 0) {
              primaryMap.set(vp.pageNum, vp);
            } else {
              nonPrimary.push(vp);
            }
          }

          const reordered: VirtualPage[] = [];
          for (const pn of op.pageOrder) {
            const vp = primaryMap.get(pn);
            if (vp) {
              reordered.push(vp);
              primaryMap.delete(pn);
            }
          }

          // Add any remaining primary pages not in pageOrder
          for (const vp of primaryMap.values()) {
            reordered.push(vp);
          }

          // Non-primary pages stay at the end
          virtualPages = [...reordered, ...nonPrimary];
        }
        break;
      }

      case "duplicate": {
        if (op.sourcePage !== undefined && op.insertAfter !== undefined) {
          const srcVp = virtualPages.find(
            (vp) => vp.source === "primary" && vp.pageNum === op.sourcePage
          );
          if (srcVp) {
            const insertIdx = Math.min(op.insertAfter, virtualPages.length);
            virtualPages.splice(insertIdx, 0, { ...srcVp });
          }
        }
        break;
      }

      case "addBlank": {
        const insertAt = op.insertAt ? op.insertAt - 1 : virtualPages.length;
        const w = op.width || 595;
        const h = op.height || 842;
        virtualPages.splice(Math.min(insertAt, virtualPages.length), 0, {
          source: "blank",
          pageNum: 0,
          rotation: 0,
          width: w,
          height: h,
        });
        break;
      }

      case "import": {
        if (op.fileId && op.pages && importBuffers) {
          const importBuf = importBuffers.get(op.fileId);
          if (importBuf) {
            const importDoc = await PDFDocument.load(importBuf, { ignoreEncryption: true });
            const insertAt = op.insertAt ? op.insertAt - 1 : virtualPages.length;

            const newPages: VirtualPage[] = [];
            for (const pn of op.pages) {
              if (pn >= 1 && pn <= importDoc.getPageCount()) {
                const importPage = importDoc.getPage(pn - 1);
                const { width, height } = importPage.getSize();
                newPages.push({
                  source: op.fileId,
                  pageNum: pn,
                  rotation: 0,
                  width,
                  height,
                });
              }
            }

            virtualPages.splice(
              Math.min(insertAt, virtualPages.length),
              0,
              ...newPages
            );
          }
        }
        break;
      }
    }
  }

  // Now build the output PDF
  const outputDoc = await PDFDocument.create();

  // Load import docs if needed
  const loadedImportDocs = new Map<string, Awaited<ReturnType<typeof PDFDocument.load>>>();
  if (importBuffers) {
    for (const [fileId, buf] of importBuffers) {
      loadedImportDocs.set(
        fileId,
        await PDFDocument.load(buf, { ignoreEncryption: true })
      );
    }
  }

  for (const vp of virtualPages) {
    if (vp.source === "blank") {
      const page = outputDoc.addPage([vp.width, vp.height]);
      if (vp.rotation !== 0) {
        page.setRotation(degrees(vp.rotation));
      }
    } else if (vp.source === "primary") {
      const [copiedPage] = await outputDoc.copyPages(sourceDoc, [vp.pageNum - 1]);
      if (vp.rotation !== 0) {
        const existingRotation = copiedPage.getRotation().angle;
        copiedPage.setRotation(degrees((existingRotation + vp.rotation) % 360));
      }
      outputDoc.addPage(copiedPage);
    } else {
      // Imported page
      const importDoc = loadedImportDocs.get(vp.source);
      if (importDoc) {
        const [copiedPage] = await outputDoc.copyPages(importDoc, [vp.pageNum - 1]);
        if (vp.rotation !== 0) {
          const existingRotation = copiedPage.getRotation().angle;
          copiedPage.setRotation(degrees((existingRotation + vp.rotation) % 360));
        }
        outputDoc.addPage(copiedPage);
      }
    }
  }

  const resultBytes = await outputDoc.save();
  return {
    resultBuffer: Buffer.from(resultBytes),
    pageCount: outputDoc.getPageCount(),
  };
}
