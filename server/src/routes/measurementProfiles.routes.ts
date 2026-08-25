import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { requireParam } from "../utils/params";
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
      req.actor!.tenantId,
      requireParam(req, "customerId"),
      requireParam(req, "productId")
    );
    res.status(200).json({ data: profile });
  } catch (err) {
    next(err);
  }
});
