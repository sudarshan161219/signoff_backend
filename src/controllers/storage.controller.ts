import { Response, NextFunction, Request } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../types/types";
import { StorageService } from "../services/storage.service";
import { AppError } from "../errors/AppError";
import { StatusCodes } from "http-status-codes";

declare global {
  namespace Express {
    interface Request {
      projectId?: string;
    }
  }
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
];

interface SignUrlBody {
  filename: string;
  mimetype: string;
  size: number;
}

@injectable()
export class StorageController {
  constructor(
    @inject(TYPES.StorageService)
    private storageService: StorageService
  ) {}

  /**
   * STEP 1: Get Pre-signed PUT URL
   * POST /api/storage/sign-url
   */

  async getUploadUrl(
    req: Request ,
    res: Response,
    next: NextFunction
  ) {
    try {
      // 1. projectId comes from the middleware (via x-admin-token)
      const projectId = req.projectId;
      const { filename, mimetype, size: rawSize } = req.body as SignUrlBody;

      if (!projectId) {
        throw new AppError({
          message: "Unauthorized: No active project context",
          statusCode: StatusCodes.UNAUTHORIZED,
        });
      }

      if (!filename || !mimetype) {
        throw new AppError({
          message: "Filename and mimetype are required",
          statusCode: StatusCodes.BAD_REQUEST,
        });
      }

      if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
        throw new AppError({
          message:
            "Invalid file type. Only PNG, JPG, WEBP, JPEG and PDF are allowed.",
          statusCode: StatusCodes.BAD_REQUEST,
        });
      }

      if (rawSize === undefined) {
        throw new AppError({
          message: "File size is required",
          statusCode: StatusCodes.BAD_REQUEST,
        });
      }

      const size = Number(rawSize);

      // --- LIMITATION 2: FILE SIZE ---
      if (isNaN(size) || size <= 0 || size > MAX_FILE_SIZE) {
        throw new AppError({
          message: "Invalid file size. Maximum size is 50MB.",
          statusCode: StatusCodes.BAD_REQUEST,
        });
      }

      // 2. Call Service
      const data = await this.storageService.getUploadUrl(
        filename,
        mimetype,
        projectId
      );

      res.status(StatusCodes.OK).json({
        message: "Upload authorized",
        ...data, // Returns { uploadUrl, key }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * STEP 2: Confirm Upload
   * POST /api/storage/confirm
   */
  async confirmUpload(
    req: Request ,
    res: Response,
    next: NextFunction
  ) {
    try {
      const projectId = req.projectId;
      const { key, filename, size, mimetype } = req.body;

      if (!projectId) {
        throw new AppError({
          message: "Unauthorized",
          statusCode: StatusCodes.UNAUTHORIZED,
        });
      }

      if (!key || !filename || !size) {
        throw new AppError({
          message: "Missing file metadata (key, filename, size)",
          statusCode: StatusCodes.BAD_REQUEST,
        });
      }

      if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
        throw new AppError({
          message: "Invalid file type",
          statusCode: StatusCodes.BAD_REQUEST,
        });
      }

      if (typeof size !== "number" || size <= 0 || size > MAX_FILE_SIZE) {
        throw new AppError({
          message: "Invalid file size. Maximum size is 50MB.",
          statusCode: StatusCodes.BAD_REQUEST,
        });
      }

      const attachment = await this.storageService.confirmUpload({
        projectId,
        key,
        filename,
        size,
        mimeType: mimetype,
      });

      res.status(StatusCodes.CREATED).json({
        message: "File successfully attached to project",
        attachment,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Download Link (Secure)
   * GET /api/storage/download/:id
   * Used by the Dashboard (Admin) to view the file.
   */
  async getDownloadUrl(
    req: Request ,
    res: Response,
    next: NextFunction
  ) {
    try {
      const fileId = req.params.id;
      const projectId = req.projectId;

      if (!projectId) {
        throw new AppError({
          message: "Unauthorized",
          statusCode: StatusCodes.UNAUTHORIZED,
        });
      }

      if (!fileId) {
        throw new AppError({
          message: "File ID required",
          statusCode: StatusCodes.BAD_REQUEST,
        });
      }

      const data = await this.storageService.getDownloadUrl(fileId, projectId);

      res.status(StatusCodes.OK).json(data); // Returns { url, filename }
    } catch (error) {
      next(error);
    }
  }

  /**
   * List Files (Optional Helper)
   * GET /api/storage/list/:projectId
   */
  async getAttachments(
    req: Request ,
    res: Response,
    next: NextFunction
  ) {
    try {
      const projectId = req.projectId;
      if (!projectId)
        throw new AppError({
          message: "Unauthorized",
          statusCode: StatusCodes.UNAUTHORIZED,
        });

      const files = await this.storageService.getAttachments(projectId);
      res.status(StatusCodes.OK).json(files);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Filename (Optional)
   * PATCH /api/storage/:id
   */
  async updateFilename(
    req: Request ,
    res: Response,
    next: NextFunction
  ) {
    // Implementation depends on if you want to support renaming
    // For MVP, you can leave this empty or remove it.
    throw new AppError({
      message: "Renaming files is not supported",
      statusCode: StatusCodes.NOT_IMPLEMENTED,
    });
  }

  /**
   * Delete File
   * DELETE /api/storage/:id
   */
  async deleteAttachments(
    req: Request ,
    res: Response,
    next: NextFunction
  ) {
    try {
      const fileId = req.params.id;
      const projectId = req.projectId;

      if (!projectId) {
        throw new AppError({
          message: "Unauthorized",
          statusCode: StatusCodes.UNAUTHORIZED,
        });
      }

      if (!fileId) {
        throw new AppError({
          message: "File ID required",
          statusCode: StatusCodes.BAD_REQUEST,
        });
      }

      await this.storageService.deleteAttachments(fileId, projectId);

      res
        .status(StatusCodes.OK)
        .json({ success: true, message: "File deleted" });
    } catch (error) {
      next(error);
    }
  }
}
