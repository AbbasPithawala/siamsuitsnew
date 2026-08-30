import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer, { MulterError } from "multer";
import { authenticate } from "../middleware/authenticate";
import { HttpError } from "../utils/http-error";
import { resolveUserPermissions } from "../services/permissions.service";
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
 * `orders.create`/`orders.edit` OR a retailer-linked actor uploading for itself — the
 * same self-service-identity-is-its-own-allowance convention `retailers.routes.ts`'s
 * `assertCanUpdateRetailer` already uses for `PATCH /retailers/:id`, added when
 * `RetailerProfilePage.tsx`'s logo upload became this endpoint's third real caller: a
 * retailer role customized without `orders.create`/`orders.edit` (both currently
 * default-seeded on the "Retailer" role, but tenant-editable) would otherwise be
 * blocked from uploading their own profile logo for reasons that have nothing to do
 * with orders. An uploaded-but-unattached file is harmless on its own regardless of
 * who uploaded it — the real write into a specific record (an order, `retailers.logo`
 * via `PATCH /retailers/:id`, etc.) is separately permission/identity-gated by that
 * record's own route.
 */
async function assertCanUpload(actor: { id: string; actorType: string; retailerId: string | null }): Promise<void> {
  if (actor.retailerId) return;
  if (actor.actorType !== "user") throw new HttpError(403, "FORBIDDEN", "This actor type has no permissions");
  const granted = await resolveUserPermissions(actor.id);
  if (!granted.has("orders.create") && !granted.has("orders.edit")) {
    throw new HttpError(403, "FORBIDDEN", "Missing required permission: orders.create or orders.edit");
  }
}

/** Generic, order-agnostic file upload — not `/api/orders/uploads` on purpose, so any consumer (order flows, `RetailerProfilePage.tsx`'s logo, future ones) can reuse it. See `assertCanUpload`'s doc comment for the access rule. */
uploadsRouter.post(
  "/uploads",
  authenticate,
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await assertCanUpload(req.actor!);
      next();
    } catch (err) {
      next(err);
    }
  },
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
