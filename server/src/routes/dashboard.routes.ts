import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import * as dashboardService from "../services/dashboard.service";

/** Open to any authenticated actor — matches the current open `/dashboard` client route; there is no "view dashboard" permission key. Scoping (retailer vs. admin) comes entirely from `req.actor.retailerId`. */
export const dashboardRouter = Router();

dashboardRouter.get("/dashboard/summary", authenticate, async (req, res, next) => {
  try {
    const summary = await dashboardService.getDashboardSummary(req.actor!.tenantId!, req.actor!.retailerId);
    res.status(200).json({ data: summary });
  } catch (err) {
    next(err);
  }
});
