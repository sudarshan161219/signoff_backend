import { StatusCodes } from "http-status-codes";

export interface AppErrorArgs {
  message: string;
  statusCode?: number;
  code?: string;
  debugMessage?: string;
  cause?: Error;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly debugMessage?: string;
  public readonly isOperational: boolean;
  public readonly cause?: unknown;

  constructor(args: AppErrorArgs) {
    super(args.message);
    this.statusCode = args.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    this.code = args.code;
    this.debugMessage = args.debugMessage;
    this.cause = args.cause;
    this.isOperational = true;

    Object.setPrototypeOf(this, AppError.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
