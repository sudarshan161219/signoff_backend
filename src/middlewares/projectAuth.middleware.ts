import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prismaClient"; // Adjust path
import { AppError } from "../errors/AppError";
import { StatusCodes } from "http-status-codes";

declare global {
  namespace Express {
    interface Request {
      projectId?: string;
    }
  }
}

export const requireProjectAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Get the token from headers
    const token = req.headers["x-admin-token"] as string;

    if (!token) {
      throw new AppError({
        message: "Authentication required (Missing Admin Token)",
        statusCode: StatusCodes.UNAUTHORIZED,
      });
    }

    // 2. Find the project with this secret token
    const project = await prisma.project.findUnique({
      where: { adminToken: token },
    });

    if (!project) {
      throw new AppError({
        message: "Invalid Admin Token",
        statusCode: StatusCodes.FORBIDDEN,
      });
    }

    // 3. ATTACH projectId to the request object
    // This allows the Controller to know WHICH project we are uploading for.
    req.projectId = project.id;

    next();
  } catch (error) {
    next(error);
  }
};