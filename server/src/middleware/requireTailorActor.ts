import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";

/**
 * Must run after `authenticate`. Tailor-portal counterpart to `requirePermission.ts` —
 * tailors have no role/permission system (`requirePermission.ts`'s own doc comment), so
 * there's nothing to resolve here: a tailor-portal route's capability set is fixed, not
 * role-configurable, and `tailorPortal.routes.ts`'s own services (`completeStep`/
 * `createExtraPayment`/`removeExtraPayment` with an `actorTailorId`) do the actual
 * per-record ownership scoping. This just keeps staff `"user"` sessions out of the portal
 * entirely, same as `requirePermission` keeps tailor sessions out of staff-only routes.
 */
export function requireTailorActor(req: Request, _res: Response, next: NextFunction): void {
  if (!req.actor) {
    next(new HttpError(500, "MISSING_ACTOR", "requireTailorActor used without authenticate"));
    return;
  }

  if (req.actor.actorType !== "tailor") {
    next(new HttpError(403, "FORBIDDEN", "This endpoint is for tailor sessions only"));
    return;
  }

  next();
}
