import { injectable } from "inversify";
import { prisma } from "../utils/prismaClient";
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
import { LogAction, ActorRole } from "@prisma/client";

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
      throw new AppError({
        message: "Invalid upload data",
        statusCode: 400,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // A. Check if project already has a file
      const existingFile = await tx.file.findUnique({
        where: { projectId: data.projectId },
      });

      if (existingFile) {
        // 1. Delete old DB record
        await tx.file.delete({
          where: { id: existingFile.id },
        });

        // 2. Delete old file from R2 (non-blocking)
        this.deleteObjectFromR2(existingFile.storageKey).catch(console.error);
      }

      // B. Create new file record
      const newFile = await tx.file.create({
        data: {
          fileName: data.filename,
          mimeType: data.mimeType,
          size: data.size,
          storageKey: data.key,
          projectId: data.projectId,
        },
      });

      // C. Audit log (ADMIN action)
      await tx.auditLog.create({
        data: {
          action: LogAction.FILE_UPLOADED,
          actorRole: ActorRole.ADMIN,
          projectId: data.projectId,
        },
      });

      return newFile;
    });

    return result;
  }

  /**
   * 3. GET DOWNLOAD LINK
   * Generates a signed GET url for viewing/downloading.
   */
  async getDownloadUrl(
    fileId: string,
    projectId: string,
    forceDownload = false
  ) {
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
      ResponseContentDisposition: forceDownload
        ? `attachment; filename="${file.fileName}"`
        : "inline",
    });

    // Link valid for 1 hour
    const url = await getSignedUrl(r2, command, { expiresIn: 3600 });

    return { url, filename: file.fileName };
  }

  /**
   * 4. DELETE FILE
   */
  async deleteAttachments(
    fileId: string,
    projectId: string,
    adminToken: string
  ) {
    // 1. Verify Project & Token Match
    // We check if the project exists AND if the provided token matches the stored adminToken
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { adminToken: true }, // Select only what we need
    });

    if (!project || project.adminToken !== adminToken) {
      throw new AppError({
        message: "Unauthorized access",
        statusCode: 401, // Using 401 for invalid credentials
      });
    }

    // 2. Find the file
    // Ensure the file actually belongs to this project
    const file = await prisma.file.findUnique({
      where: { id: fileId, projectId },
    });

    if (!file) {
      throw new AppError({ message: "File not found", statusCode: 404 });
    }

    // 3. Delete from R2 Storage
    await this.deleteObjectFromR2(file.storageKey);

    // 4. Delete from Database
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
