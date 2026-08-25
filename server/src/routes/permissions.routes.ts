import { Router } from "express";
import { db } from "../db/index";
import { authenticate } from "../middleware/authenticate";

/**
 * Gated by `authenticate` only, not `rbac.permissions.view` — a user without
 * `rbac.roles.manage` can still legitimately need to see what a role *could* grant (e.g.
 * a read-only view of a role's assignments, or the roles UI rendering the catalog as
 * checkboxes even for a viewer who can't edit them). `permissions` also isn't a
 * tenant-scoped table at all (see `tenancy.ts`) — there's no tenant-owned data here to
 * protect, just a fixed catalog every authenticated actor is allowed to know exists.
 * `rbac.permissions.view` stays seeded in the catalog for a future case where that
 * changes, but nothing currently checks it.
 */
export const permissionsRouter = Router();

permissionsRouter.get("/permissions", authenticate, async (_req, res, next) => {
  try {
    const list = await db.query.permissions.findMany({
      orderBy: (p, { asc }) => [asc(p.module), asc(p.key)],
    });
    res.status(200).json({ data: list });
  } catch (err) {
    next(err);
  }
});
