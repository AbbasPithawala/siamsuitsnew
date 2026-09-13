import type { NextFunction, Request, Response } from "express";
import { db } from "../db/index";
import { verifyToken } from "../services/auth.service";
import { HttpError } from "../utils/http-error";

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    next(new HttpError(401, "UNAUTHORIZED", "Missing or malformed authorization header"));
    return;
  }

  let payload;
  try {
    payload = verifyToken(header.slice("Bearer ".length));
  } catch {
    next(new HttpError(401, "UNAUTHORIZED", "Invalid or expired token"));
    return;
  }

  if (payload.actorType === "platform_admin") {
    const platformAdmin = await db.query.platformAdmins.findFirst({ where: (t, { eq }) => eq(t.id, payload.sub) });
    if (!platformAdmin || !platformAdmin.isActive) {
      next(new HttpError(401, "UNAUTHORIZED", "Invalid or inactive account"));
      return;
    }

    req.actor = {
      id: platformAdmin.id,
      tenantId: null,
      actorType: "platform_admin",
      retailerId: null,
    };
    next();
    return;
  }

  const actorRow =
    payload.actorType === "user"
      ? await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, payload.sub) })
      : await db.query.tailors.findFirst({ where: (t, { eq }) => eq(t.id, payload.sub) });

  if (!actorRow || !actorRow.isActive) {
    next(new HttpError(401, "UNAUTHORIZED", "Invalid or inactive account"));
    return;
  }

  const retailerLink =
    payload.actorType === "user"
      ? await db.query.retailerUsers.findFirst({ where: (t, { eq }) => eq(t.userId, actorRow.id) })
      : undefined;

  req.actor = {
    id: actorRow.id,
    tenantId: actorRow.tenantId,
    actorType: payload.actorType,
    retailerId: retailerLink?.retailerId ?? null,
  };
  next();
}
