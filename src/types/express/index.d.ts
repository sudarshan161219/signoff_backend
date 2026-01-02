import { JwtUserPayload } from "../auth.types";

import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}

export interface AuthRequest extends Request {
  user?: JwtUserPayload;
  query: {
    clientId?: string;
    invoiceId?: string;
    noteId?: string;
  };
}

export interface AuthFileRequest extends Request {
  user?: JwtUserPayload;
  file?: Express.Multer.File;
  body: {
    originalname?: string;
    filename?: string;
    clientId?: string;
    invoiceId?: string;
    ids?: number;
    type?: string;
  };
}
