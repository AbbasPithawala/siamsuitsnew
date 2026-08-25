import { Router } from "express";
import multer, { MulterError } from "multer";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { HttpError } from "../utils/http-error";
import { storageBackend } from "../services/storage.service";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new HttpError(415, "INVALID_FILE_TYPE", "Only image uploads are supported"));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();

/**
 * Generic, order-agnostic file upload — not `/api/orders/uploads` on purpose, so any
 * future consumer (e.g. Phase 8 Group 4's feature/style-image upload) can reuse it.
 * Gated on `orders.create` OR `orders.edit` — its two real callers today:
 * `StylingAccordion.tsx`'s reference-image upload (order creation, Retailer-held
 * permission) and `ManualSizeEditor.tsx`'s Manual Size annotation upload (order
 * editing, Owner-held permission per PHASE_10_TASKS.md Workstream E Group 5/6 — Owner
 * lost `orders.create` but needs this endpoint for edits). Was `orders.create` only
 * until Group 6 surfaced the gap: an uploaded-but-unattached file is harmless on its
 * own, the real write into an order is separately gated by each order route itself,
 * so this stays a plain OR rather than special-casing per caller.
 */
uploadsRouter.post(
  "/uploads",
  authenticate,
  requirePermission(["orders.create", "orders.edit"]),
  (req, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
        next(new HttpError(413, "FILE_TOO_LARGE", `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES} bytes`));
        return;
      }
      next(err);
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file) {
        next(new HttpError(400, "FILE_REQUIRED", "A 'file' field with an image is required"));
        return;
      }
      const result = await storageBackend.upload(req.file.buffer, req.file.mimetype, "generic");
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);
