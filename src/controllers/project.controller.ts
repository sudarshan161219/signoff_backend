import { Request, Response, NextFunction } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../types/types"; // Ensure this matches your types file
import { ProjectService } from "../services/project.service";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../errors/AppError";
import { Status } from "@prisma/client";

@injectable()
export class ProjectController {
  constructor(
    @inject(TYPES.ProjectService)
    private projectService: ProjectService
  ) {}

  /**
   * CREATE PROJECT
   * POST /api/projects
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.body;

      if (!name || typeof name !== "string") {
        throw new AppError({
          message: "Project name is required",
          statusCode: StatusCodes.BAD_REQUEST,
        });
      }

      const project = await this.projectService.createProject(name);

      res.status(StatusCodes.CREATED).json({
        message: "Project created successfully",
        data: project, // Frontend should save project.adminToken
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ADMIN VIEW (Dashboard)
   * Usage: GET /api/projects/admin/:token
   */
  async getAdminOne(req: Request, res: Response, next: NextFunction) {
    try {
      // const { token } = req.params;
      const authHeader = req.headers.authorization; //adminToken

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new AppError({ message: "Unauthorized", statusCode: 401 });
      }

      const token = authHeader.split(" ")[1];

      const adminView = await this.projectService.getProjectByAdminToken(token);

      if (!adminView) {
        throw new AppError({
          message: "Project not found",
          statusCode: StatusCodes.NOT_FOUND,
        });
      }

      return res.status(StatusCodes.OK).json({
        role: "ADMIN",
        data: adminView,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * CLIENT VIEW (Public Link)
   * Usage: GET /api/projects/view/:token
   */
  async getPublicOne(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params; // This is the publicToken
      const ip =
        (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
      const userAgent = req.headers["user-agent"];

      if (!token) {
        throw new AppError({
          message: "Token required",
          statusCode: StatusCodes.BAD_REQUEST,
        });
      }

      const publicView = await this.projectService.getProjectByPublicToken(
        token,
        ip,
        userAgent
      );

      // getProjectByPublicToken throws its own errors (404/Gone) if validation fails,
      // so we don't need extra checks here.

      return res.status(StatusCodes.OK).json({
        role: "CLIENT",
        data: publicView,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * UPDATE STATUS
   * POST /api/projects/:token/status
   */
  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const { status, comment } = req.body;

      const ip =
        (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
      const userAgent = req.headers["user-agent"];

      // Validation
      if (!token) {
        throw new AppError({
          message: "Token is required",
          statusCode: StatusCodes.BAD_REQUEST,
        });
      }

      const validStatuses = [Status.APPROVED, Status.CHANGES_REQUESTED];
      if (!validStatuses.includes(status)) {
        throw new AppError({
          message: `Invalid status. Must be one of: ${validStatuses.join(
            ", "
          )}`,
          statusCode: StatusCodes.BAD_REQUEST,
        });
      }

      // Call Service
      const result = await this.projectService.updateStatus(
        token,
        status,
        comment,
        ip,
        userAgent
      );

      res.status(StatusCodes.OK).json({
        message: "Status updated",
        data: {
          status: result.status,
          updatedAt: result.updatedAt,
          comment: result.approvalDecision,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // src/controllers/project.controller.ts

  async updateExpiration(req: Request, res: Response, next: NextFunction) {
    try {
      // 1. EXTRACT TOKEN FROM HEADER
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new AppError({ message: "Unauthorized", statusCode: 401 });
      }
      const token = authHeader.split(" ")[1]; // <--- This gets the actual token

      // 2. GET DAYS FROM BODY
      const { days } = req.body;
      if (!days) {
        throw new AppError({
          message: "Duration (days) is required",
          statusCode: 400,
        });
      }

      // 3. CALL SERVICE
      const project = await this.projectService.updateExpiration(
        token,
        Number(days)
      );

      res.status(200).json({ data: project });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      // 1. Extract Token from Header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new AppError({
          message: "Unauthorized",
          statusCode: StatusCodes.UNAUTHORIZED,
        });
      }

      const token = authHeader.split(" ")[1];

      // 2. Call Service
      const result = await this.projectService.deleteProject(token);

      // 3. Respond
      res.status(StatusCodes.OK).json(result);
    } catch (error) {
      next(error);
    }
  }
}
