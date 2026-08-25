import { Router } from "express";
import { db } from "../db/index";
import { authenticate } from "../middleware/authenticate";
import { resolveUserPermissions } from "../services/permissions.service";
import { HttpError } from "../utils/http-error";

export const meRouter = Router();

meRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const actor = req.actor!;

    if (actor.actorType === "user") {
      const user = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, actor.id) });
      if (!user) throw new HttpError(401, "UNAUTHORIZED", "Invalid or inactive account");

      const permissions = await resolveUserPermissions(user.id);
      res.status(200).json({
        data: {
          id: user.id,
          name: user.name,
          username: user.username,
          actorType: "user" as const,
          tenantId: user.tenantId,
          retailerId: actor.retailerId,
          permissions: [...permissions],
        },
      });
      return;
    }

    const tailor = await db.query.tailors.findFirst({ where: (t, { eq }) => eq(t.id, actor.id) });
    if (!tailor) throw new HttpError(401, "UNAUTHORIZED", "Invalid or inactive account");

    res.status(200).json({
      data: {
        id: tailor.id,
        name: tailor.name,
        username: tailor.username,
        actorType: "tailor" as const,
        tenantId: tailor.tenantId,
        retailerId: actor.retailerId,
        permissions: [] as string[],
      },
    });
  } catch (err) {
    next(err);
  }
});
