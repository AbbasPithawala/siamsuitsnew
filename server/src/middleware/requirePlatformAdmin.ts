import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";

/**
 * Must run after `authenticate`. Structural copy of `requireTailorActor.ts` — platform
 * admins have no role/permission system either (A3): every capability under
 * `/api/platform/*` is fixed, not role-configurable, so there's nothing to resolve here.
 */
export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.actor) {
    next(new HttpError(500, "MISSING_ACTOR", "requirePlatformAdmin used without authenticate"));
    return;
  }

  if (req.actor.actorType !== "platform_admin") {
    next(new HttpError(403, "FORBIDDEN", "This endpoint is for platform admin sessions only"));
    return;
  }

  next();
}
