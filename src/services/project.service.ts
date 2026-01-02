import { injectable } from "inversify";
import { prisma } from "../utils/prismaClient";
import { r2 } from "../lib/r2";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { AppError } from "../errors/AppError";
import { StatusCodes } from "http-status-codes";
import { Status, LogAction } from "@prisma/client";

@injectable()
export class ProjectService {
  private bucket = process.env.CF_BUCKET_NAME!;
  /**
   * CREATE PROJECT
   * Generates the Admin Token (for you) and Public Token (for client)
   */
  async createProject(name: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const project = await prisma.project.create({
      data: {
        name,
        expiresAt,
        logs: {
          create: { action: LogAction.PROJECT_CREATED },
        },
      },
    });
    return project;
  }

  /**
   * GET PROJECT (ADMIN VIEW)
   * Returns everything including sensitive data + logs
   */
  async getProjectByAdminToken(token: string) {
    const project = await prisma.project.findUnique({
      where: { adminToken: token },
      include: {
        file: true,
        logs: { orderBy: { createdAt: "desc" } },
        approvalDecision: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!project)
      throw new AppError({ message: "Project not found", statusCode: 404 });

    let signedUrl: string | null = null;

    if (project.file) {
      try {
        const command = new GetObjectCommand({
          Bucket: process.env.CF_BUCKET_NAME,
          Key: project.file.storageKey,
        });
        // We still tell R2 to expire it in 1 hour, but we don't tell the frontend
        signedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });
      } catch (error) {
        console.error("Admin URL Signing Error:", error);
      }
    }

    const [latestDecision] = project.approvalDecision;

    return {
      ...project,
      file: project.file ? { ...project.file, url: signedUrl } : null,
      latestComment: latestDecision?.comment ?? null,
    };
  }

  /**
   * GET PROJECT (CLIENT VIEW)
   * Read-only. Returns only what the client needs to see.
   */
  async getProjectByPublicToken(
    token: string,
    ip?: string,
    userAgent?: string
  ) {
    const project = await prisma.project.findUnique({
      where: { publicToken: token },
      include: {
        file: true,
        approvalDecision: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!project)
      throw new AppError({ message: "Project not found", statusCode: 404 });

    // CHECK: 30-Day Project Expiration (KEEP THIS!)
    if (project.expiresAt && project.expiresAt < new Date()) {
      throw new AppError({
        message: "This project link has expired",
        statusCode: 410,
      });
    }

    // LOG VIEW
    prisma.auditLog
      .create({
        data: {
          action: "CLIENT_VIEWED",
          projectId: project.id,
          ipAddress: ip,
          userAgent: userAgent,
        },
      })
      .catch(console.error);

    let signedUrl: string | null = null;

    if (project.file) {
      try {
        const command = new GetObjectCommand({
          Bucket: process.env.CF_BUCKET_NAME,
          Key: project.file.storageKey,
        });
        signedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });
      } catch (error) {
        console.error("Client URL Signing Error:", error);
      }
    }

    const latestDecision = project.approvalDecision[0];

    return {
      name: project.name,
      status: project.status,
      expiresAt: project.expiresAt, // Keep this for the "30 Days Left" badge
      file: project.file
        ? {
            filename: project.file.fileName,
            mimeType: project.file.mimeType,
            size: project.file.size,
            url: signedUrl, // <--- Just the URL, no more expiry date
          }
        : null,
      clientFeedback: latestDecision?.comment || null,
    };
  }

  /**
   * UPDATE STATUS (Approve/Reject)
   */
  async updateStatus(
    publicToken: string,
    status: Status,
    comment?: string,
    ip?: string,
    userAgent?: string
  ) {
    // 1. Fetch project AND the latest decision to compare
    const project = await prisma.project.findUnique({
      where: { publicToken },
      include: {
        approvalDecision: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!project) {
      throw new AppError({ message: "Project not found", statusCode: 404 });
    }

    // 2. GLOBAL LOCK
    if (project.status === "APPROVED") {
      throw new AppError({
        message: "Project is already approved and locked.",
        statusCode: StatusCodes.BAD_REQUEST,
      });
    }

    // 3. IDEMPOTENCY CHECK
    const lastDecision = project.approvalDecision[0];
    const isSameStatus = project.status === status;
    const isSameComment = (lastDecision?.comment || "") === (comment || "");

    if (isSameStatus && isSameComment) {
      // Return the EXISTING data formatted correctly
      return {
        ...project,
        latestComment: lastDecision?.comment || null,
      };
    }

    // 4. PERFORM UPDATE (With the Fix)
    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        status,
        approvalDecision: {
          create: {
            decision: status,
            comment,
            ipAddress: ip,
            userAgent,
          },
        },
        logs: {
          create: {
            action:
              status === "APPROVED"
                ? LogAction.CLIENT_APPROVED
                : LogAction.CLIENT_REQUESTED_CHANGES,
            ipAddress: ip,
            userAgent,
          },
        },
      },
      // <--- THIS IS THE FIX: Tell Prisma to return the relation we just created
      include: {
        approvalDecision: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    // 5. Return a clean object including the comment
    return {
      ...updated,
      latestComment: updated.approvalDecision[0]?.comment || null,
    };
  }

  async updateExpiration(adminToken: string, days: number) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    return await prisma.project.update({
      where: { adminToken },
      data: { expiresAt },
    });
  }

  async deleteProject(adminToken: string) {
    const project = await prisma.project.findUnique({
      where: { adminToken },
      include: { file: true },
    });

    if (!project) {
      throw new AppError({
        message: "Project not found",
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    if (project.file && project.file.storageKey) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: process.env.CF_BUCKET_NAME,
          Key: project.file.storageKey,
        });
        await r2.send(command);
      } catch (error) {
        console.error("[R2] Delete Error:", error);
      }
    }

    await prisma.project.delete({
      where: { id: project.id },
    });

    return { success: true, message: "Project and files deleted permanently" };
  }
}
