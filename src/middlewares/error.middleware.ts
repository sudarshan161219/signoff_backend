import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { StatusCodes, getReasonPhrase } from "http-status-codes";

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode =
    err instanceof AppError
      ? err.statusCode
      : StatusCodes.INTERNAL_SERVER_ERROR;

  const response: {
    success: false;
    message: string;
    stack?: string;
    debug?: string;
  } = {
    success: false,
    message: err.message || getReasonPhrase(statusCode),
  };

  if (process.env.NODE_ENV !== "production") {
    response.stack = err.stack;
    if (err instanceof AppError && err.debugMessage) {
      response.debug = err.debugMessage;
    }
  } else {
    // Optional: Log internal error info in production
    console.error("Unhandled Error:", {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  res.status(statusCode).json(response);
}
