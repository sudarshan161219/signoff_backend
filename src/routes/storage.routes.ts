import { Router } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../types/types"; // Adjust path as needed
import { StorageController } from "../controllers/storage.controller";
import { requireProjectAdmin } from "../middlewares/projectAuth.middleware";
import { wrapWithAuthFileRequest } from "../utils/wrapWithAuthRequest";

@injectable()
export class StorageRouter {
  public router: Router;

  constructor(
    @inject(TYPES.StorageController) // Ensure this matches your inversify.config.ts
    private StorageController: StorageController
  ) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // ---------------------------------------------------------
    // 1. STEP ONE: Get Upload Permission (Pre-signed URL)
    // Frontend sends { filename, mimetype }
    // Backend returns { uploadUrl, key }
    // ---------------------------------------------------------
    this.router.post(
      "/sign-url",
      requireProjectAdmin,
      wrapWithAuthFileRequest(
        this.StorageController.getUploadUrl.bind(this.StorageController)
      )
    );

    // ---------------------------------------------------------
    // 2. STEP TWO: Confirm Upload Success
    // Frontend sends { key, filename, size, ... }
    // Backend saves record to DB
    // ---------------------------------------------------------
    this.router.post(
      "/confirm",
      requireProjectAdmin,
      wrapWithAuthFileRequest(
        this.StorageController.confirmUpload.bind(this.StorageController)
      )
    );

    // ---------------------------------------------------------
    // 3. GET FILES
    // ---------------------------------------------------------

    // Get all files for a specific Client
    // this.router.get(
    //   "/list/:clientId", // Changed from "/upload/:id" to be clearer
    //   requireProjectAdmin,
    //   wrapWithAuthFileRequest(
    //     this.StorageController.getAttachments.bind(this.StorageController)
    //   )
    // );

    // Get Download Link (Signed GET URL) for a single file
    this.router.get(
      "/download/:id", // Changed from "/getSignedUrl/:id" to be standard
      requireProjectAdmin,
      wrapWithAuthFileRequest(
        this.StorageController.getDownloadUrl.bind(this.StorageController)
      )
    );

    // ---------------------------------------------------------
    // 4. MANAGEMENT (Update/Delete)
    // ---------------------------------------------------------

    // Update filename
    // this.router.patch(
    //   "/:id", // Simplified route from "/update/:id"
    //   requireProjectAdmin,
    //   wrapWithAuthFileRequest(
    //     this.StorageController.updateFilename.bind(this.StorageController)
    //   )
    // );

    // Bulk Delete (Preferred)
    // Send { ids: [1, 2, 3] } in body
    this.router.delete(
      "/",
      requireProjectAdmin,
      wrapWithAuthFileRequest(
        this.StorageController.deleteAttachments.bind(this.StorageController)
      )
    );

    // Single Delete via Param (Optional, handled by same controller logic)
    this.router.post(
      "/:id",
      requireProjectAdmin,
      wrapWithAuthFileRequest(
        this.StorageController.deleteAttachments.bind(this.StorageController)
      )
    );
  }
}
