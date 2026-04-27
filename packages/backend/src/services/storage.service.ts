/**
 * Storage Service
 * Handles Cloudflare R2 uploads and operations
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("StorageService");

export interface StorageUploadResult {
  success: boolean;
  path: string;
  size: number;
  error?: string;
}

export class StorageService {
  private static s3Client: S3Client | null = null;

  /**
   * Initialize S3 client for R2
   */
  private static initializeS3Client(): S3Client {
    if (this.s3Client) {
      return this.s3Client;
    }

    this.s3Client = new S3Client({
      region: env.R2_REGION,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    });

    logger.info("S3 client initialized for R2");
    return this.s3Client;
  }

  /**
   * Upload buffer to R2
   */
  static async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ): Promise<StorageUploadResult> {
    try {
      const client = this.initializeS3Client();

      const command = new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await client.send(command);

      logger.info("File uploaded to R2", {
        key,
        size: buffer.length,
      });

      return {
        success: true,
        path: key,
        size: buffer.length,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to upload file to R2", {
        key,
        error: errorMessage,
      });

      return {
        success: false,
        path: key,
        size: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate pre-signed URL for file access
   */
  static async generatePresignedUrl(
    key: string,
    expirationSeconds: number = 86400, // 24 hours
  ): Promise<string | null> {
    try {
      const client = this.initializeS3Client();

      const command = new GetObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
      });

      const url = await getSignedUrl(client, command, {
        expiresIn: expirationSeconds,
      });

      return url;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to generate pre-signed URL", {
        key,
        error: errorMessage,
      });

      return null;
    }
  }

  /**
   * Delete file from R2
   */
  static async deleteFile(key: string): Promise<boolean> {
    try {
      const client = this.initializeS3Client();

      const command = new DeleteObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
      });

      await client.send(command);

      logger.info("File deleted from R2", { key });
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to delete file from R2", {
        key,
        error: errorMessage,
      });

      return false;
    }
  }
}
