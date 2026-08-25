import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { requireParam } from "../utils/params";
import * as manufacturingService from "../services/manufacturing.service";

const assignStepSchema = z.object({
  tailorId: z.string().uuid(),
});

export const manufacturingRouter = Router();

/**
 * Read-only lookup for the job-assignment/completion screen (PHASE_6_TASKS.md
 * Group 7) — `authenticate` only, same open-read convention as
 * `tailors.routes.ts`'s `GET /tailors[/:id]`; the mutating assign/complete
 * routes below are what actually need permission gates.
 */
manufacturingRouter.get("/manufacturing/components/:componentId", authenticate, async (req, res, next) => {
  try {
    const detail = await manufacturingService.getComponentDetail(req.actor!.tenantId, requireParam(req, "componentId"));
    res.status(200).json({ data: detail });
  } catch (err) {
    next(err);
  }
});

manufacturingRouter.post(
  "/manufacturing/components/:componentId/assign",
  authenticate,
  requirePermission("factory.jobs.assign"),
  validateBody(assignStepSchema),
  async (req, res, next) => {
    try {
      const result = await manufacturingService.assignNextStep(req.actor!.tenantId, requireParam(req, "componentId"), req.body.tailorId);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

manufacturingRouter.post(
  "/manufacturing/jobs/:jobId/complete",
  authenticate,
  requirePermission("factory.jobs.complete"),
  async (req, res, next) => {
    try {
      const step = await manufacturingService.completeStep(req.actor!.tenantId, requireParam(req, "jobId"));
      res.status(200).json({ data: step });
    } catch (err) {
      next(err);
    }
  }
);
