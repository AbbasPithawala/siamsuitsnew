import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { requireParam } from "../utils/params";
import * as payrollService from "../services/payroll.service";
import { generateSettlementPdf } from "../services/settlementPdf.service";
import { generateJobSlipPdf } from "../services/jobSlipPdf.service";

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

/** `WorkerPaymentHistoryPage.tsx`'s list of past settlements for a tailor — same permission as every other payroll read/write above. */
payrollRouter.get(
  "/tailors/:tailorId/settlements",
  authenticate,
  requirePermission("factory.payroll.settle"),
  async (req, res, next) => {
    try {
      const settlements = await payrollService.listSettlements(req.actor!.tenantId, requireParam(req, "tailorId"));
      res.status(200).json({ data: settlements });
    } catch (err) {
      next(err);
    }
  }
);

/** Legacy `WorkPaymentHistory.jsx`'s `exportPDF` — server-rendered here instead (`settlementPdf.service.ts`'s doc comment). Not persisted, so `POST` (a fresh render each call) rather than a cached `GET`. */
payrollRouter.post(
  "/tailors/:tailorId/settlements/:id/pdf",
  authenticate,
  requirePermission("factory.payroll.settle"),
  async (req, res, next) => {
    try {
      const path = await generateSettlementPdf(req.actor!.tenantId, requireParam(req, "tailorId"), requireParam(req, "id"));
      res.status(201).json({ data: { path } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Legacy `ManageJobs.jsx`'s per-job "Print" action (`jobSlipPdf.service.ts`'s doc comment) —
 * printable before the job is ever settled, from the payroll settlement screen's unpaid-jobs
 * table. Same permission as the read it's generated from (`listUnpaidCompletedJobs`), not
 * job-scoped under `/manufacturing/jobs/...`, matching `extra-payments.routes.ts`'s own
 * `/jobs/:jobId/...` convention for job-scoped-but-not-manufacturing-step-mutating routes.
 */
payrollRouter.post(
  "/jobs/:jobId/slip-pdf",
  authenticate,
  requirePermission("factory.payroll.settle"),
  async (req, res, next) => {
    try {
      const path = await generateJobSlipPdf(req.actor!.tenantId, requireParam(req, "jobId"));
      res.status(201).json({ data: { path } });
    } catch (err) {
      next(err);
    }
  }
);
