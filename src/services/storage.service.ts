import { injectable } from "inversify";
import  prisma  from "../utils/prismaClient";
import { AppError } from "../errors/AppError";
import { StatusCodes } from "http-status-codes";
import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2 } from "../lib/r2";
import { randomUUID } from "crypto";
import { LogAction } from "@prisma/client";

@injectable()
export class StorageService {
  private bucket = process.env.CF_BUCKET_NAME!;

  /**
   * 1. GET UPLOAD PERMISSION
   * Generates a pre-signed PUT url for the specific Project ID.
   */
  async getUploadUrl(fileName: string, mimeType: string, projectId: string) {
    // Organized path: projects/{projectId}/{uuid}-{filename}
    const key = `projects/${projectId}/${randomUUID()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    // Link expires in 10 minutes
    const signedUrl = await getSignedUrl(r2, command, { expiresIn: 600 });

    return {
      uploadUrl: signedUrl,
      key: key,
    };
  }

  /**
   * 2. CONFIRM UPLOAD & SAVE METADATA
   * Handles the "One Project = One File" rule.
   * If a file exists, it replaces it.
   */
  async confirmUpload(data: {
    key: string;
    filename: string;
    size: number;
    mimeType: string;
    projectId: string;
  }) {
    if (!data.key || !data.projectId) {
      throw new AppError({ message: "Invalid upload data", statusCode: 400 });
    }

    // Use a Transaction to keep DB state clean
    return await prisma.$transaction(async (tx) => {
      // A. Check if this project already has a file (Cleanup)
      const existingFile = await tx.file.findUnique({
        where: { projectId: data.projectId },
      });

      if (existingFile) {
        // 1. Delete old record from DB
        await tx.file.delete({
          where: { id: existingFile.id },
        });

        // 2. Delete old file from R2 (Async - don't await/block the user)
        this.deleteObjectFromR2(existingFile.storageKey).catch(console.error);
      }

      // B. Create the new File record
      const newFile = await tx.file.create({
        data: {
          fileName: data.filename, // Note: Schema uses 'fileName'
          mimeType: data.mimeType,
          size: data.size,
          storageKey: data.key, // Note: Schema uses 'storageKey'
          projectId: data.projectId,
        },
      });

      // C. Add Audit Log
      await tx.auditLog.create({
        data: {
          action: LogAction.FILE_UPLOADED,
          projectId: data.projectId,
        },
      });

      return newFile;
    });
  }

  /**
   * 3. GET DOWNLOAD LINK
   * Generates a signed GET url for viewing/downloading.
   */
  async getDownloadUrl(fileId: string, projectId: string) {
    const file = await prisma.file.findUnique({
      where: { id: fileId, projectId },
    });

    if (!file) {
      throw new AppError({ message: "File not found", statusCode: 404 });
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: file.storageKey,
      // This forces the browser to download nicely with the real name
      ResponseContentDisposition: `attachment; filename="${file.fileName}"`,
    });

    // Link valid for 1 hour
    const url = await getSignedUrl(r2, command, { expiresIn: 3600 });

    return { url, filename: file.fileName };
  }

  /**
   * 4. DELETE FILE
   */
  async deleteAttachments(fileId: string, projectId: string) {
    const file = await prisma.file.findUnique({
      where: { id: fileId, projectId },
    });

    if (!file) {
      throw new AppError({ message: "File not found", statusCode: 404 });
    }

    // 1. Delete from R2
    await this.deleteObjectFromR2(file.storageKey);

    // 2. Delete from DB
    await prisma.file.delete({
      where: { id: fileId },
    });

    return { success: true };
  }

  /**
   * Helper: Get all attachments for a project
   * (Used by the Dashboard to list files)
   */
  async getAttachments(projectId: string) {
    return await prisma.file.findMany({
      where: { projectId },
    });
  }

  /**
   * Private Helper to delete from Cloudflare R2
   */
  private async deleteObjectFromR2(key: string) {
    try {
      await r2.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
    } catch (error) {
      console.error(`Failed to delete R2 object: ${key}`, error);
      // We don't throw here because we don't want to crash the main request
      // just because R2 cleanup failed.
    }
  }
}
