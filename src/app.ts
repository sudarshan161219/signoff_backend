import "reflect-metadata";
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { prisma } from "./utils/prismaClient";
import { addRoutes } from "./config/routes.config";
import { errorMiddleware } from "./middlewares/error.middleware";

dotenv.config();

export class App {
  public app: Application;
  public port: number;
  private prisma = prisma;

  constructor() {
    this.app = express();
    this.port = Number(process.env.PORT) || 8080;

    this.app.set("trust proxy", 1);

    this.initializeMiddlewares();
    this.initializeRateLimiter();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares() {
    this.app.use(helmet());
    this.app.use(express.json());

    this.app.use(
      cors({
        origin:
          process.env.NODE_ENV === "production"
            ? process.env.FRONTEND_URL
            : ["https://signoff-one.vercel.app"],
        credentials: true,
      })
    );
  }

  private initializeRateLimiter() {
    this.app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300,
      })
    );

    this.app.use(
      "/api/projects/view",
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 30,
      })
    );
  }

  private initializeRoutes() {
    addRoutes(this.app);
  }

  private initializeErrorHandling() {
    this.app.use(errorMiddleware);
  }

  public async start() {
    if (!process.env.DATABASE_URL) {
      console.error("❌ DATABASE_URL missing");
      process.exit(1);
    }

    await this.prisma.$connect();

    this.app.listen(this.port, () => {
      console.log(`🚀 Server running on port ${this.port}`);
    });

    process.on("SIGTERM", async () => {
      await this.prisma.$disconnect();
      process.exit(0);
    });
  }
}

new App().start();
