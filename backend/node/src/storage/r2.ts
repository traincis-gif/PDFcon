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

const s3Client = new S3Client({
  region: "auto",
  endpoint: config.R2_ACCOUNT_ID
    ? `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : "http://localhost:9000", // MinIO fallback for dev
  credentials: {
    accessKeyId: config.R2_ACCESS_KEY_ID || "minioadmin",
    secretAccessKey: config.R2_SECRET_ACCESS_KEY || "minioadmin",
  },
  forcePathStyle: true,
});

const BUCKET = config.R2_BUCKET_NAME;

export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  logger.debug({ key, contentType }, "Generated upload presigned URL");
  return url;
}

export async function getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  logger.debug({ key }, "Generated download presigned URL");
  return url;
}

export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  await s3Client.send(command);
  logger.debug({ key }, "Deleted object from R2");
}

export async function objectExists(key: string): Promise<boolean> {
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
