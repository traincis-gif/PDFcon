import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { logger } from "../lib/logger";

const execFileAsync = promisify(execFile);

/** Supported input-to-output format mappings */
const SUPPORTED_CONVERSIONS: Record<string, string[]> = {
  pdf: ["docx", "xlsx", "pptx", "html", "txt", "rtf"],
  docx: ["pdf"],
  doc: ["pdf"],
  xlsx: ["pdf"],
  xls: ["pdf"],
  pptx: ["pdf"],
  ppt: ["pdf"],
  html: ["pdf"],
  htm: ["pdf"],
  rtf: ["pdf"],
  odt: ["pdf"],
  ods: ["pdf"],
  odp: ["pdf"],
  txt: ["pdf"],
  csv: ["pdf"],
};

/**
 * Map output format strings to the LibreOffice filter name.
 * LibreOffice --convert-to accepts short format names for most cases,
 * but some need explicit filter specification.
 */
function getLibreOfficeFormat(outputFormat: string): string {
  switch (outputFormat) {
    case "docx":
      return "docx";
    case "xlsx":
      return "xlsx";
    case "pptx":
      return "pptx";
    case "pdf":
      return "pdf";
    case "html":
      return "html";
    case "txt":
      return "txt";
    case "rtf":
      return "rtf";
    default:
      return outputFormat;
  }
}

/**
 * Get the expected output file extension for a given output format.
 */
function getOutputExtension(outputFormat: string): string {
  // LibreOffice may produce different extensions in some cases
  switch (outputFormat) {
    case "docx":
      return "docx";
    case "xlsx":
      return "xlsx";
    case "pptx":
      return "pptx";
    case "html":
      return "html";
    default:
      return outputFormat;
  }
}

export interface ConvertOptions {
  /** Timeout in milliseconds for the LibreOffice process. Default: 120000 (2 minutes) */
  timeout?: number;
}

/**
 * Convert a document from one format to another using LibreOffice in headless mode.
 *
 * @param inputBuffer - The file contents to convert
 * @param inputExt - The input file extension (without dot), e.g. "pdf", "docx"
 * @param outputFormat - The desired output format, e.g. "pdf", "docx", "xlsx"
 * @param options - Optional conversion options
 * @returns Buffer containing the converted file
 */
export async function convertWithLibreOffice(
  inputBuffer: Buffer,
  inputExt: string,
  outputFormat: string,
  options?: ConvertOptions
): Promise<Buffer> {
  const normalizedInput = inputExt.toLowerCase().replace(/^\./, "");
  const normalizedOutput = outputFormat.toLowerCase().replace(/^\./, "");
  const timeout = options?.timeout ?? 120_000;

  // Validate the conversion is supported
  const allowedOutputs = SUPPORTED_CONVERSIONS[normalizedInput];
  if (!allowedOutputs) {
    throw new Error(`Unsupported input format: ${normalizedInput}`);
  }
  if (!allowedOutputs.includes(normalizedOutput)) {
    throw new Error(
      `Unsupported conversion: ${normalizedInput} -> ${normalizedOutput}. ` +
      `Allowed output formats for ${normalizedInput}: ${allowedOutputs.join(", ")}`
    );
  }

  logger.info(
    { inputExt: normalizedInput, outputFormat: normalizedOutput, bufferSize: inputBuffer.length },
    "Starting LibreOffice conversion"
  );

  // Create separate directories for work and LibreOffice profile
  const workDir = await mkdtemp(path.join(tmpdir(), "lo-convert-"));
  const homeDir = await mkdtemp(path.join(tmpdir(), "lo-home-"));
  const inputFileName = `input.${normalizedInput}`;
  const inputFilePath = path.join(workDir, inputFileName);

  try {
    // Write input buffer to temp file
    await writeFile(inputFilePath, inputBuffer);

    const loFormat = getLibreOfficeFormat(normalizedOutput);

    // Run LibreOffice headless conversion
    const args = [
      "--headless",
      "--norestore",
      "--nolockcheck",
      "--nologo",
      "--nodefault",
      "--nofirststartwizard",
      `-env:UserInstallation=file://${homeDir}`,
      "--convert-to",
      loFormat,
      "--outdir",
      workDir,
      inputFilePath,
    ];

    logger.debug({ args }, "Executing LibreOffice");

    try {
      const { stdout, stderr } = await execFileAsync("libreoffice", args, {
        timeout,
        env: {
          ...process.env,
          HOME: homeDir,
        },
      });

      if (stderr) {
        logger.warn({ stderr }, "LibreOffice stderr output");
      }

      logger.debug({ stdout }, "LibreOffice stdout output");
    } catch (execError: unknown) {
      const err = execError as Error & { stderr?: string; code?: number };
      logger.error(
        { error: err.message, stderr: err.stderr, code: err.code },
        "LibreOffice conversion failed"
      );
      throw new Error(`LibreOffice conversion failed: ${err.message}`);
    }

    // Find the output file - LibreOffice names it based on the input filename
    const expectedExt = getOutputExtension(normalizedOutput);
    const expectedOutputName = `input.${expectedExt}`;
    const expectedOutputPath = path.join(workDir, expectedOutputName);

    // Try the expected path first, otherwise scan the directory
    let outputPath: string;
    try {
      await readFile(expectedOutputPath);
      outputPath = expectedOutputPath;
    } catch {
      // Scan directory for output file (exclude input, dirs, dotfiles)
      const { stat } = await import("node:fs/promises");
      const files = await readdir(workDir);
      const outputFile = files.find((f) => {
        if (f === inputFileName) return false;
        if (f.startsWith(".")) return false; // Skip .cache, .config, etc.
        // Check it's a file, not a directory
        try {
          const s = require("node:fs").statSync(path.join(workDir, f));
          return s.isFile();
        } catch {
          return false;
        }
      });

      if (!outputFile) {
        const allFiles = files.join(", ");
        throw new Error(
          `LibreOffice conversion produced no output file. Files in workdir: ${allFiles}`
        );
      }

      outputPath = path.join(workDir, outputFile);
    }

    // Read the output file
    const outputBuffer = await readFile(outputPath);

    logger.info(
      {
        inputExt: normalizedInput,
        outputFormat: normalizedOutput,
        inputSize: inputBuffer.length,
        outputSize: outputBuffer.length,
      },
      "LibreOffice conversion complete"
    );

    return outputBuffer;
  } finally {
    // Clean up temp directories
    for (const dir of [workDir, homeDir]) {
      try {
        await rm(dir, { recursive: true, force: true });
      } catch (cleanupError) {
        logger.warn({ dir, error: cleanupError }, "Failed to clean up temp directory");
      }
    }
  }
}
