import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config";
import { logger } from "../lib/logger";
import { validateStorageKey } from "../middleware/security";
import * as fs from "fs/promises";
import * as path from "path";

/** Check if R2/S3 is configured */
const useS3 = Boolean(config.R2_ACCOUNT_ID && config.R2_ACCESS_KEY_ID && config.R2_SECRET_ACCESS_KEY);

/** Local filesystem storage directory when S3 is not configured */
const LOCAL_STORAGE_DIR = "/tmp/pdflow-storage";

if (!useS3) {
  logger.warn("R2/S3 not configured — using local filesystem at /tmp/pdflow-storage");
}

const s3Client = useS3
  ? new S3Client({
      region: "auto",
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    })
  : null;

const BUCKET = config.R2_BUCKET_NAME;

/** Presigned upload URL TTL: 15 minutes */
const UPLOAD_URL_EXPIRY = 15 * 60;

/** Presigned download URL TTL: 1 hour */
const DOWNLOAD_URL_EXPIRY = 60 * 60;

// --- Local filesystem helpers ---

async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function localPath(key: string): string {
  return path.join(LOCAL_STORAGE_DIR, key);
}

// --- Public API ---

export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresIn = UPLOAD_URL_EXPIRY
): Promise<string> {
  validateStorageKey(key);

  if (!s3Client) {
    // Return a placeholder URL — direct upload not supported without S3
    return `local://${key}`;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  logger.debug({ key, contentType, expiresIn }, "Generated upload presigned URL");
  return url;
}

export async function getDownloadUrl(key: string, expiresIn = DOWNLOAD_URL_EXPIRY): Promise<string> {
  validateStorageKey(key);

  if (!s3Client) {
    return `local://${key}`;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  logger.debug({ key, expiresIn }, "Generated download presigned URL");
  return url;
}

export async function deleteObject(key: string): Promise<void> {
  validateStorageKey(key);

  if (!s3Client) {
    try {
      await fs.unlink(localPath(key));
    } catch {
      // File may not exist
    }
    return;
  }

  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  await s3Client.send(command);
  logger.debug({ key }, "Deleted object from R2");
}

export async function objectExists(key: string): Promise<boolean> {
  validateStorageKey(key);

  if (!s3Client) {
    try {
      await fs.access(localPath(key));
      return true;
    } catch {
      return false;
    }
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch {
    return false;
  }
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  validateStorageKey(key);

  if (!s3Client) {
    const filePath = localPath(key);
    const data = await fs.readFile(filePath);
    return Buffer.from(data);
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  const response = await s3Client.send(command);
  const stream = response.Body;
  if (!stream) throw new Error(`No body returned for key: ${key}`);

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  validateStorageKey(key);

  if (!s3Client) {
    const filePath = localPath(key);
    await ensureDir(filePath);
    await fs.writeFile(filePath, body);
    logger.debug({ key, contentType, size: body.length }, "Saved object to local storage");
    return;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);
  logger.debug({ key, contentType, size: body.length }, "Uploaded object to R2");
}

export { s3Client, BUCKET };
