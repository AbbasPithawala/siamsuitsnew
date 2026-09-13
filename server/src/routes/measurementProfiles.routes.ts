import { z } from "zod";
import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { requireParam } from "../utils/params";
import { HttpError } from "../utils/http-error";
import * as measurementProfilesService from "../services/measurementProfiles.service";

/**
 * Reads are gated by `authenticate` only, same convention as `measurements.routes.ts`/
 * `features.routes.ts` — the order-builder's Measurements panel pre-fill (PHASE_10_TASKS.md
 * Workstream D Group 1/3) needs this the same as everything else it reads. No write route:
 * this resource is only ever written as a side effect of order creation
 * (`orders.service.ts#buildOrder`), never directly.
 */
export const measurementProfilesRouter = Router();

measurementProfilesRouter.get("/customers/:customerId/measurement-profiles/:productId", authenticate, async (req, res, next) => {
  try {
    const profile = await measurementProfilesService.getCustomerMeasurementProfile(
      req.actor!.tenantId!,
      requireParam(req, "customerId"),
      requireParam(req, "productId")
    );
    res.status(200).json({ data: profile });
  } catch (err) {
    next(err);
  }
});

const measurementBaselineQuerySchema = z.object({ excludeOrderId: z.string().uuid().optional() });

/**
 * PHASE_10_TASKS.md follow-up — backs the order-builder's live "changed from profile"
 * checkmark with the exact same comparison the server uses when actually saving
 * (`measurementProfiles.service.ts#getMeasurementBaseline`'s own doc comment explains why this
 * is a different question than `GET .../measurement-profiles/:productId` above). `excludeOrderId`
 * is the order currently open in the edit wizard, if any — so that order's own not-yet-resaved
 * component never counts as its own baseline while its form is open.
 */
measurementProfilesRouter.get("/customers/:customerId/measurement-baseline/:productId", authenticate, async (req, res, next) => {
  try {
    const parsed = measurementBaselineQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(new HttpError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid query"));
      return;
    }
    const baseline = await measurementProfilesService.getMeasurementBaseline(
      req.actor!.tenantId!,
      requireParam(req, "customerId"),
      requireParam(req, "productId"),
      parsed.data.excludeOrderId
    );
    res.status(200).json({ data: baseline });
  } catch (err) {
    next(err);
  }
});
