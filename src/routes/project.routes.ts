import { Router, Request, Response, NextFunction } from "express";
import { injectable, inject } from "inversify";
import { body, param, validationResult } from "express-validator";
import { TYPES } from "../types/types";
import { Status } from "@prisma/client";
import { ProjectController } from "../controllers/project.controller";

@injectable()
export class ProjectRouter {
  public router: Router;

  constructor(
    @inject(TYPES.ProjectController)
    private projectController: ProjectController
  ) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * 1. CREATE PROJECT
     * POST /api/projects
     */
    this.router.post(
      "/",
      // A. Add Validation Rules
      [
        body("name")
          .trim()
          .isString()
          .notEmpty()
          .withMessage("Project name is required"),
      ],
      // B. The Handler
      async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          // C. Fix: Add 'return' to stop execution
          res.status(400).json({ errors: errors.array() });
          return;
        }
        // We need to bind context or use the arrow function properly
        await this.projectController.create(req as any, res, next);
      }
    );

    // 2. ADMIN VIEW (Dashboard)
    // Matches: /api/projects/admin/uuid-123-secret-key
    this.router.get(
      "/admin/me",
      [param("token").isUUID().withMessage("Invalid project token")],
      (req: Request, res: Response, next: NextFunction) =>
        this.projectController.getAdminOne(req, res, next)
    );

    // 3. CLIENT VIEW (Public)
    // Matches: /api/projects/view/uuid-456-public-key
    this.router.get(
      "/view/:token",
      [param("token").isUUID().withMessage("Invalid project token")],
      async (req: Request, res: Response, next: NextFunction) => {
        // No body validation needed for GET, just params
        await this.projectController.getPublicOne(req as any, res, next);
      }
    );

    /**
     * 3. UPDATE STATUS
     * POST /api/projects/:token/status
     */
    this.router.post(
      "/:token/status",
      [
        // Validate status is one of the allowed enums
        body("status")
          .isIn([Status.APPROVED, Status.CHANGES_REQUESTED])
          .withMessage("Invalid status"),
      ],
      async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({ errors: errors.array() });
          return;
        }
        await this.projectController.updateStatus(req as any, res, next);
      }
    );

    this.router.patch(
      "/admin/expiration",
      async (req: Request, res: Response, next: NextFunction) => {
        await this.projectController.updateExpiration(req, res, next);
      }
    );

    this.router.delete(
      "/admin/me",
      async (req: Request, res: Response, next: NextFunction) => {
        await this.projectController.delete(req, res, next);
      }
    );
  }
}
