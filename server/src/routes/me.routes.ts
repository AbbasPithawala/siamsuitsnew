import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index";
import { users } from "../db/schema/index";
import { authenticate } from "../middleware/authenticate";
import { validateBody } from "../middleware/validateBody";
import { hashPassword, verifyPassword } from "../services/auth.service";
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

      // Header branding (AppShell.tsx): a retailer-linked session shows that retailer's own
      // logo — they're a distinct business the tenant serves — otherwise the tenant's own
      // letterhead logo (`invoicePdf.service.ts`'s same `tenants.logo` field). The tenant
      // itself is always looked up (regardless of retailer-linking) since `profileCompleted`
      // always reflects the user's own tenant, not the retailer.
      const tenant = await db.query.tenants.findFirst({ where: (t, { eq }) => eq(t.id, user.tenantId) });
      const logo = actor.retailerId
        ? ((await db.query.retailers.findFirst({ where: (t, { eq }) => eq(t.id, actor.retailerId!) }))?.logo ?? null)
        : (tenant?.logo ?? null);

      res.status(200).json({
        data: {
          id: user.id,
          name: user.name,
          username: user.username,
          actorType: "user" as const,
          tenantId: user.tenantId,
          retailerId: actor.retailerId,
          permissions: [...permissions],
          logo,
          mustChangePassword: user.mustChangePassword,
          profileCompleted: tenant?.profileCompleted ?? true,
        },
      });
      return;
    }

    if (actor.actorType === "platform_admin") {
      const platformAdmin = await db.query.platformAdmins.findFirst({ where: (t, { eq }) => eq(t.id, actor.id) });
      if (!platformAdmin) throw new HttpError(401, "UNAUTHORIZED", "Invalid or inactive account");

      res.status(200).json({
        data: {
          id: platformAdmin.id,
          name: platformAdmin.name,
          username: platformAdmin.username,
          actorType: "platform_admin" as const,
          tenantId: null,
          retailerId: null,
          permissions: [] as string[],
          logo: null,
          mustChangePassword: false,
          profileCompleted: true,
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
        logo: null,
        mustChangePassword: false,
        profileCompleted: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

meRouter.patch("/me/password", authenticate, validateBody(changePasswordSchema), async (req, res, next) => {
  try {
    const actor = req.actor!;
    if (actor.actorType !== "user") {
      throw new HttpError(403, "FORBIDDEN", "Self-service password change is only available to staff/retailer users");
    }

    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;

    const user = await db.query.users.findFirst({ where: (t, { eq: eqOp }) => eqOp(t.id, actor.id) });
    if (!user) throw new HttpError(401, "UNAUTHORIZED", "Invalid or inactive account");

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw new HttpError(401, "UNAUTHORIZED", "Current password is incorrect");

    const passwordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    res.status(200).json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});
