import type { NextFunction, Request, Response } from "express";
import { resolveUserPermissions } from "../services/permissions.service";
import { HttpError } from "../utils/http-error";

/**
 * Must run after `authenticate`. Tailors have no role/permission system
 * (PHASE_2_TASKS.md Group 0) — any tailor-issued token is unconditionally 403'd here.
 *
 * `keys` accepts a single permission or an array; an array is an OR — holding any one of
 * them is sufficient (e.g. `shipping.view` OR `shipping.manage`).
 */
export function requirePermission(keys: string | string[]) {
  const required = Array.isArray(keys) ? keys : [keys];

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.actor) {
      next(new HttpError(500, "MISSING_ACTOR", "requirePermission used without authenticate"));
      return;
    }

    if (req.actor.actorType !== "user") {
      next(new HttpError(403, "FORBIDDEN", "This actor type has no permissions"));
      return;
    }

    const grantedPermissions = await resolveUserPermissions(req.actor.id);
    if (!required.some((key) => grantedPermissions.has(key))) {
      next(new HttpError(403, "FORBIDDEN", `Missing required permission: ${required.join(" or ")}`));
      return;
    }

    next();
  };
}
