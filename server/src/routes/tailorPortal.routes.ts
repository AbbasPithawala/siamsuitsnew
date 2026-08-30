import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requireTailorActor } from "../middleware/requireTailorActor";
import { validateBody } from "../middleware/validateBody";
import { requireParam } from "../utils/params";
import { assignNextStep, completeStep } from "../services/manufacturing.service";
import { createExtraPayment, removeExtraPayment, listExtraPayments } from "../services/extra-payments.service";
import { listSettlements, getSettlement } from "../services/payroll.service";
import { generateSettlementPdf } from "../services/settlementPdf.service";

const createExtraPaymentSchema = z.object({
  categoryId: z.string().uuid(),
});

const statusQuerySchema = z.enum(["pending", "approved", "rejected"]).optional();

/**
 * Self-service tailor portal — a deliberately separate router from every staff-facing one,
 * gated by `requireTailorActor` rather than `requirePermission`: tailors have no role/
 * permission system in this codebase (see that middleware's own doc comment), so there's no
 * permission to check, only "is this actually a tailor session." Every route below forces
 * `req.actor!.id` in as the tailor identity — never a client-supplied tailor id anywhere,
 * body or URL — reusing the exact same services the staff-facing `JobAssignmentPage.tsx`/
 * `WorkerPaymentHistoryPage.tsx`/`ExtraPaymentsApprovalPage.tsx` already call, scoped via
 * each one's `actorTailorId` param (or, for `listSettlements`/`getSettlement`/
 * `generateSettlementPdf`/`listExtraPayments`, their pre-existing `tailorId` param/filter).
 */
export const tailorPortalRouter = Router();

tailorPortalRouter.post(
  "/tailor-portal/components/:componentId/assign-self",
  authenticate,
  requireTailorActor,
  async (req, res, next) => {
    try {
      const result = await assignNextStep(req.actor!.tenantId, requireParam(req, "componentId"), req.actor!.id);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

tailorPortalRouter.post("/tailor-portal/jobs/:jobId/complete", authenticate, requireTailorActor, async (req, res, next) => {
  try {
    const step = await completeStep(req.actor!.tenantId, requireParam(req, "jobId"), req.actor!.id);
    res.status(200).json({ data: step });
  } catch (err) {
    next(err);
  }
});

tailorPortalRouter.post(
  "/tailor-portal/jobs/:jobId/extra-payments",
  authenticate,
  requireTailorActor,
  validateBody(createExtraPaymentSchema),
  async (req, res, next) => {
    try {
      const extraPayment = await createExtraPayment(
        req.actor!.tenantId,
        requireParam(req, "jobId"),
        req.body.categoryId,
        req.actor!.id
      );
      res.status(201).json({ data: extraPayment });
    } catch (err) {
      next(err);
    }
  }
);

tailorPortalRouter.delete(
  "/tailor-portal/jobs/:jobId/extra-payments/:categoryId",
  authenticate,
  requireTailorActor,
  async (req, res, next) => {
    try {
      await removeExtraPayment(req.actor!.tenantId, requireParam(req, "jobId"), requireParam(req, "categoryId"), req.actor!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

tailorPortalRouter.get("/tailor-portal/settlements", authenticate, requireTailorActor, async (req, res, next) => {
  try {
    const settlements = await listSettlements(req.actor!.tenantId, req.actor!.id);
    res.status(200).json({ data: settlements });
  } catch (err) {
    next(err);
  }
});

tailorPortalRouter.get("/tailor-portal/settlements/:id", authenticate, requireTailorActor, async (req, res, next) => {
  try {
    const result = await getSettlement(req.actor!.tenantId, req.actor!.id, requireParam(req, "id"));
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

tailorPortalRouter.post("/tailor-portal/settlements/:id/pdf", authenticate, requireTailorActor, async (req, res, next) => {
  try {
    const path = await generateSettlementPdf(req.actor!.tenantId, req.actor!.id, requireParam(req, "id"));
    res.status(201).json({ data: { path } });
  } catch (err) {
    next(err);
  }
});

tailorPortalRouter.get("/tailor-portal/extra-payments", authenticate, requireTailorActor, async (req, res, next) => {
  try {
    const status = statusQuerySchema.parse(req.query.status);
    const filter: { status?: "pending" | "approved" | "rejected"; tailorId: string } = { tailorId: req.actor!.id };
    if (status) filter.status = status;
    const extraPayments = await listExtraPayments(req.actor!.tenantId, filter);
    res.status(200).json({ data: extraPayments });
  } catch (err) {
    next(err);
  }
});
