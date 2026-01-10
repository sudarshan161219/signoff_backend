import { injectable } from "inversify";
import { prisma } from "../utils/prismaClient";
import { r2 } from "../lib/r2";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { AppError } from "../errors/AppError";
import { StatusCodes } from "http-status-codes";
import {
  ProjectStatus,
  ApprovalDecisionType,
  ActorRole,
  LogAction,
} from "@prisma/client";

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
        status: ProjectStatus.PENDING,
        logs: {
          create: {
            action: LogAction.PROJECT_CREATED,
            actorRole: ActorRole.ADMIN,
          },
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
        decisions: { orderBy: { createdAt: "desc" }, take: 1 },
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

    const [latestDecision] = project.decisions;

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
        decisions: { orderBy: { createdAt: "desc" }, take: 1 },
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
          action: LogAction.CLIENT_VIEWED,
          actorRole: ActorRole.CLIENT,
          projectId: project.id,
          ipAddress: ip,
          userAgent,
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

    const latestDecision = project.decisions[0];

    return {
      name: project.name,
      status: project.status,
      expiresAt: project.expiresAt, // Keep this for the "30 Days Left" badge
      file: project.file
        ? {
            fileId: project.file.id,
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
    decision: ApprovalDecisionType,
    comment?: string,
    ip?: string,
    userAgent?: string
  ) {
    const project = await prisma.project.findUnique({
      where: { publicToken },
      include: {
        decisions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!project) {
      throw new AppError({ message: "Project not found", statusCode: 404 });
    }

    // Global lock
    if (project.status === ProjectStatus.APPROVED) {
      throw new AppError({
        message: "Project already approved and locked.",
        statusCode: StatusCodes.BAD_REQUEST,
      });
    }

    const lastDecision = project.decisions[0];

    // Idempotency
    if (
      lastDecision?.type === decision &&
      (lastDecision?.comment || "") === (comment || "")
    ) {
      return {
        ...project,
        latestComment: lastDecision?.comment ?? null,
      };
    }

    const newStatus =
      decision === ApprovalDecisionType.APPROVED
        ? ProjectStatus.APPROVED
        : ProjectStatus.CHANGES_REQUESTED;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id: project.id },
        data: { status: newStatus },
      });

      const newDecision = await tx.approvalDecision.create({
        data: {
          type: decision,
          actorRole: ActorRole.CLIENT,
          comment,
          projectId: project.id,
          ipAddress: ip,
          userAgent,
        },
      });

      await tx.auditLog.create({
        data: {
          action:
            decision === ApprovalDecisionType.APPROVED
              ? LogAction.CLIENT_APPROVED
              : LogAction.CLIENT_REQUESTED_CHANGES,
          actorRole: ActorRole.CLIENT,
          projectId: project.id,
          ipAddress: ip,
          userAgent,
        },
      });

      return { updatedProject, newDecision };
    });

    return {
      ...updated.updatedProject,
      latestComment: updated.newDecision.comment ?? null,
    };
  }

  async updateExpiration(adminToken: string, days: number) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    return await prisma.project.update({
      where: { adminToken },
      data: {
        expiresAt,
        logs: {
          create: {
            action: LogAction.PROJECT_UPDATED,
            actorRole: ActorRole.ADMIN,
          },
        },
      },
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
