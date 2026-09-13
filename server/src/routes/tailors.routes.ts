import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { paginationQuerySchema, paginatedResult } from "../utils/pagination";
import * as tailorsService from "../services/tailors.service";

const createTailorSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(8),
  isActive: z.boolean().optional(),
});

const updateTailorSchema = z.object({
  name: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
});

const certifyTailorSchema = z.object({
  processId: z.string().uuid(),
});

const listTailorsQuerySchema = paginationQuerySchema;

/**
 * Reads are gated by `authenticate` only; `factory.tailors.manage` gates writes, including
 * process certification (certifying a tailor is part of managing them, per
 * PHASE_3_TASKS.md Group 7) — same convention as every other catalog/customer resource.
 * `password` is plaintext here and hashed in `tailors.service.ts` before it ever touches
 * the database — never accept a pre-hashed value from a client.
 */
export const tailorsRouter = Router();

tailorsRouter.get("/tailors", authenticate, async (req, res, next) => {
  try {
    const { page, pageSize } = listTailorsQuerySchema.parse(req.query);
    const { data, total } = await tailorsService.listTailors(req.actor!.tenantId!, { page, pageSize });
    res.status(200).json(paginatedResult(data, total, page, pageSize));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid query"));
      return;
    }
    next(err);
  }
});

tailorsRouter.get("/tailors/:id", authenticate, async (req, res, next) => {
  try {
    const tailor = await tailorsService.getTailor(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(200).json({ data: tailor });
  } catch (err) {
    next(err);
  }
});

tailorsRouter.post(
  "/tailors",
  authenticate,
  requirePermission("factory.tailors.manage"),
  validateBody(createTailorSchema),
  async (req, res, next) => {
    try {
      const tailor = await tailorsService.createTailor(req.actor!.tenantId!, req.body);
      res.status(201).json({ data: tailor });
    } catch (err) {
      next(err);
    }
  }
);

tailorsRouter.patch(
  "/tailors/:id",
  authenticate,
  requirePermission("factory.tailors.manage"),
  validateBody(updateTailorSchema),
  async (req, res, next) => {
    try {
      const tailor = await tailorsService.updateTailor(req.actor!.tenantId!, requireParam(req, "id"), req.body);
      res.status(200).json({ data: tailor });
    } catch (err) {
      next(err);
    }
  }
);

tailorsRouter.delete("/tailors/:id", authenticate, requirePermission("factory.tailors.manage"), async (req, res, next) => {
  try {
    await tailorsService.softDeleteTailor(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

tailorsRouter.post(
  "/tailors/:tailorId/processes",
  authenticate,
  requirePermission("factory.tailors.manage"),
  validateBody(certifyTailorSchema),
  async (req, res, next) => {
    try {
      const certifications = await tailorsService.certifyTailor(req.actor!.tenantId!, requireParam(req, "tailorId"), req.body.processId);
      res.status(201).json({ data: certifications });
    } catch (err) {
      next(err);
    }
  }
);

tailorsRouter.delete(
  "/tailors/:tailorId/processes/:processId",
  authenticate,
  requirePermission("factory.tailors.manage"),
  async (req, res, next) => {
    try {
      await tailorsService.decertifyTailor(req.actor!.tenantId!, requireParam(req, "tailorId"), requireParam(req, "processId"));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);
