import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { requireParam } from "../utils/params";
import * as extraPaymentsService from "../services/extra-payments.service";

const createExtraPaymentSchema = z.object({
  categoryId: z.string().uuid(),
});

export const extraPaymentsRouter = Router();

extraPaymentsRouter.post(
  "/jobs/:jobId/extra-payments",
  authenticate,
  requirePermission("factory.extra_payments.manage"),
  validateBody(createExtraPaymentSchema),
  async (req, res, next) => {
    try {
      const extraPayment = await extraPaymentsService.createExtraPayment(req.actor!.tenantId, requireParam(req, "jobId"), req.body.categoryId);
      res.status(201).json({ data: extraPayment });
    } catch (err) {
      next(err);
    }
  }
);

extraPaymentsRouter.patch(
  "/extra-payments/:id/approve",
  authenticate,
  requirePermission("factory.extra_payments.approve"),
  async (req, res, next) => {
    try {
      const extraPayment = await extraPaymentsService.approveExtraPayment(req.actor!.tenantId, requireParam(req, "id"));
      res.status(200).json({ data: extraPayment });
    } catch (err) {
      next(err);
    }
  }
);
