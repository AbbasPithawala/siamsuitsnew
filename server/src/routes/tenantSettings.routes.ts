import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import * as tenantSettingsService from "../services/tenantSettings.service";

const updateInvoiceSettingsSchema = z.object({
  logo: z.string().optional(),
  address: z.string().optional(),
  invoiceFooterText: z.string().optional(),
});

/**
 * The tenant's invoice letterhead (logo/address/footer text) — `invoicePdf.service.ts`'s only
 * consumer today, so scoped narrowly to `/invoice-settings` rather than a general `/tenant`
 * settings endpoint this app has no other use for yet. Reads gated by `invoices.view` (needed
 * to preview the current letterhead before editing it — comparably sensitive to any other
 * invoice-adjacent read); writes by `invoices.manage`, same split every other invoicing route
 * in this file's sibling `invoices.routes.ts` uses.
 */
export const tenantSettingsRouter = Router();

tenantSettingsRouter.get("/invoice-settings", authenticate, requirePermission("invoices.view"), async (req, res, next) => {
  try {
    const tenant = await tenantSettingsService.getTenantSettings(req.actor!.tenantId);
    res.status(200).json({ data: tenant });
  } catch (err) {
    next(err);
  }
});

tenantSettingsRouter.patch(
  "/invoice-settings",
  authenticate,
  requirePermission("invoices.manage"),
  validateBody(updateInvoiceSettingsSchema),
  async (req, res, next) => {
    try {
      const tenant = await tenantSettingsService.updateTenantSettings(req.actor!.tenantId, req.body);
      res.status(200).json({ data: tenant });
    } catch (err) {
      next(err);
    }
  }
);
