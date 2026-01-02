import { Container } from "inversify";

// import { AuthService } from "../services/auth.service";
// import { AuthController } from "../controllers/auth.controller";
// import { AuthRouter } from "../routes/auth.router";

import { ProjectService } from "../services/project.service";
import { ProjectController } from "../controllers/project.controller";
import { ProjectRouter } from "../routes/project.routes";

import { StorageService } from "../services/storage.service";
import { StorageController } from "../controllers/storage.controller";
import { StorageRouter } from "../routes/storage.routes";

import { TYPES } from "../types/types";

export const container: Container = new Container();

/* =======================
   AUTH
//    ======================= */
// container
//   .bind<AuthService>(TYPES.AuthService)
//   .to(AuthService)
//   .inTransientScope();

// container.bind<AuthController>(TYPES.AuthController).to(AuthController);

// container.bind<AuthRouter>(TYPES.AuthRouter).to(AuthRouter);

/* =======================
   PROJECT
   ======================= */
container
  .bind<ProjectService>(TYPES.ProjectService)
  .to(ProjectService)
  .inTransientScope();

container
  .bind<ProjectController>(TYPES.ProjectController)
  .to(ProjectController);

container.bind<ProjectRouter>(TYPES.ProjectRouter).to(ProjectRouter);

/* =======================
   STORAGE
   ======================= */
container
  .bind<StorageService>(TYPES.StorageService)
  .to(StorageService)
  .inTransientScope();

container
  .bind<StorageController>(TYPES.StorageController)
  .to(StorageController);

container.bind<StorageRouter>(TYPES.StorageRouter).to(StorageRouter);
