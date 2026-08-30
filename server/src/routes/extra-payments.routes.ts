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

const statusQuerySchema = z.enum(["pending", "approved", "rejected"]).optional();

export const extraPaymentsRouter = Router();

/** Admin approval queue (PHASE_6_TASKS.md Group 7 follow-up) — `?status=` defaults to `pending` in `listExtraPayments` itself. */
extraPaymentsRouter.get(
  "/extra-payments",
  authenticate,
  requirePermission("factory.extra_payments.approve"),
  async (req, res, next) => {
    try {
      const status = statusQuerySchema.parse(req.query.status);
      const filter: extraPaymentsService.ExtraPaymentListFilter = {};
      if (status) filter.status = status;
      if (typeof req.query.tailorId === "string") filter.tailorId = req.query.tailorId;
      const extraPayments = await extraPaymentsService.listExtraPayments(req.actor!.tenantId, filter);
      res.status(200).json({ data: extraPayments });
    } catch (err) {
      next(err);
    }
  }
);

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

/** Floor-screen undo — removes an unapproved, not-yet-completed job's attach (see `removeExtraPayment`'s doc comment). */
extraPaymentsRouter.delete(
  "/jobs/:jobId/extra-payments/:categoryId",
  authenticate,
  requirePermission("factory.extra_payments.manage"),
  async (req, res, next) => {
    try {
      await extraPaymentsService.removeExtraPayment(req.actor!.tenantId, requireParam(req, "jobId"), requireParam(req, "categoryId"));
      res.status(204).send();
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

extraPaymentsRouter.patch(
  "/extra-payments/:id/reject",
  authenticate,
  requirePermission("factory.extra_payments.approve"),
  async (req, res, next) => {
    try {
      const extraPayment = await extraPaymentsService.rejectExtraPayment(req.actor!.tenantId, requireParam(req, "id"));
      res.status(200).json({ data: extraPayment });
    } catch (err) {
      next(err);
    }
  }
);
