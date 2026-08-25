import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { requireParam } from "../utils/params";
import * as payrollService from "../services/payroll.service";

const createAdvanceSchema = z.object({
  amount: z.number().positive(),
});

const createSettlementSchema = z.object({
  jobIds: z.array(z.string().uuid()).min(1),
  rent: z.number().nonnegative().optional(),
  manualBill: z.number().nonnegative().optional(),
  deductedAdvance: z.number().nonnegative().optional(),
});

export const payrollRouter = Router();

/**
 * PHASE_6_TASKS.md Group 8's confirmed backend gap: nothing read a tailor's
 * settleable jobs before this — `payroll.service.ts` only had write
 * endpoints. Gated by `factory.payroll.settle`, the same permission
 * `POST .../settlements` requires, rather than left `authenticate`-only like
 * the catalog/tailor-roster reads: unlike a component lookup or a tailor
 * roster, this exposes per-job pay amounts (`cost`/`stylingPrice`/pending
 * extra-payment totals) for a specific tailor, which is exactly the kind of
 * financial detail `invoices.routes.ts`'s doc comment argues should sit
 * behind a real permission rather than open to any authenticated staffer —
 * and since building the settlement UI is this read's only purpose, gating
 * it on the same key that actually submits the settlement keeps both halves
 * of the workflow behind one permission an admin grants together.
 */
payrollRouter.get(
  "/tailors/:tailorId/unpaid-jobs",
  authenticate,
  requirePermission("factory.payroll.settle"),
  async (req, res, next) => {
    try {
      const list = await payrollService.listUnpaidCompletedJobs(req.actor!.tenantId, requireParam(req, "tailorId"));
      res.status(200).json({ data: list });
    } catch (err) {
      next(err);
    }
  }
);

payrollRouter.post(
  "/tailors/:tailorId/advances",
  authenticate,
  requirePermission("factory.advance_payments.manage"),
  validateBody(createAdvanceSchema),
  async (req, res, next) => {
    try {
      const result = await payrollService.createAdvancePayment(req.actor!.tenantId, requireParam(req, "tailorId"), req.body.amount);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

payrollRouter.post(
  "/tailors/:tailorId/settlements",
  authenticate,
  requirePermission("factory.payroll.settle"),
  validateBody(createSettlementSchema),
  async (req, res, next) => {
    try {
      const settlement = await payrollService.createSettlement(req.actor!.tenantId, requireParam(req, "tailorId"), req.body);
      res.status(201).json({ data: settlement });
    } catch (err) {
      next(err);
    }
  }
);

payrollRouter.get(
  "/tailors/:tailorId/settlements/:id",
  authenticate,
  requirePermission("factory.payroll.settle"),
  async (req, res, next) => {
    try {
      const result = await payrollService.getSettlement(req.actor!.tenantId, requireParam(req, "tailorId"), requireParam(req, "id"));
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);
