import archiver from "archiver";
import { logger } from "../lib/logger";

export interface ZipEntry {
  name: string;
  buffer: Buffer;
}

/**
 * Creates a ZIP archive in memory from an array of named buffers.
 */
export async function createZipArchive(files: ZipEntry[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const archive = archiver("zip", { zlib: { level: 6 } });

    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on("end", () => {
      const result = Buffer.concat(chunks);
      logger.debug(
        { fileCount: files.length, zipSize: result.length },
        "Created ZIP archive"
      );
      resolve(result);
    });

    archive.on("error", (err: Error) => {
      reject(err);
    });

    for (const file of files) {
      archive.append(file.buffer, { name: file.name });
    }

    archive.finalize();
  });
}
