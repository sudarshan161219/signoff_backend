import { Application } from "express";
import { container } from "../config/container";
// import { AuthRouter } from "../routes/auth.router";
import { ProjectRouter } from "../routes/project.routes";
import { StorageRouter } from "../routes/storage.routes";
import { TYPES } from "../types/types";

export function addRoutes(app: Application): Application {
  // const authRouter = container.get<AuthRouter>(TYPES.AuthRouter);
  const projectRouter = container.get<ProjectRouter>(TYPES.ProjectRouter);
  const storageRouter = container.get<StorageRouter>(TYPES.StorageRouter);

  // app.use("/api/auth", authRouter.router);
  app.get("/", (req, res) => {
    res.send("API Version: DEBUG-SOCKET-TEST");
  });
  app.use("/api/projects", projectRouter.router);
  app.use("/api/storage", storageRouter.router);

  return app;
}
