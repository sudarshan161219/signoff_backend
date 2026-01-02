import { AuthRequest, AuthFileRequest } from "../types/express";
import { Request, Response, NextFunction } from "express";

const wrapWithAuthRequest =
  (
    handler: (
      req: AuthRequest,
      res: Response,
      next: NextFunction
    ) => Promise<void>
  ) =>
  (req: Request, res: Response, next: NextFunction) =>
    handler(req as AuthRequest, res, next);

const wrapWithAuthFileRequest =
  (
    handler: (
      req: AuthFileRequest,
      res: Response,
      next: NextFunction
    ) => Promise<void>
  ) =>
  (req: Request, res: Response, next: NextFunction) =>
    handler(req as AuthFileRequest, res, next);

export { wrapWithAuthRequest, wrapWithAuthFileRequest };
