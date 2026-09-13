import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { resolveUserPermissions } from "../services/permissions.service";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { paginationQuerySchema, paginatedResult } from "../utils/pagination";
import * as retailersService from "../services/retailers.service";

const createRetailerSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  ownerName: z.string().min(1).optional(),
  logo: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  emailRecipients: z.array(z.string().email()).optional(),
  isActive: z.boolean().optional(),
});

const updateRetailerSchema = createRetailerSchema.partial();

const listRetailersQuerySchema = paginationQuerySchema;

/**
 * A retailer editing its own record (`actor.retailerId === id`) is an identity-based
 * allowance, not a grantable permission — same category as row-level isolation
 * (PHASE_10_TASKS.md Workstream E Decision 3) — so it's an OR alongside
 * `retailers.manage`, never a replacement for it: another retailer's record, or a
 * non-retailer-linked actor lacking `retailers.manage`, is still 403'd.
 */
async function assertCanUpdateRetailer(actorId: string, actorType: string, actorRetailerId: string | null, id: string): Promise<void> {
  if (actorRetailerId === id) return;
  if (actorType !== "user") throw new HttpError(403, "FORBIDDEN", "This actor type has no permissions");
  const granted = await resolveUserPermissions(actorId);
  if (!granted.has("retailers.manage")) throw new HttpError(403, "FORBIDDEN", "Missing required permission: retailers.manage");
}

/** Reads are gated by `authenticate` only; `retailers.manage` gates writes — same convention as `customers.routes.ts`. */
export const retailersRouter = Router();

retailersRouter.get("/retailers", authenticate, async (req, res, next) => {
  try {
    const { page, pageSize } = listRetailersQuerySchema.parse(req.query);
    const { data, total } = await retailersService.listRetailers(req.actor!.tenantId!, { page, pageSize });
    res.status(200).json(paginatedResult(data, total, page, pageSize));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid query"));
      return;
    }
    next(err);
  }
});

retailersRouter.get("/retailers/:id", authenticate, async (req, res, next) => {
  try {
    const retailer = await retailersService.getRetailer(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(200).json({ data: retailer });
  } catch (err) {
    next(err);
  }
});

retailersRouter.post(
  "/retailers",
  authenticate,
  requirePermission("retailers.manage"),
  validateBody(createRetailerSchema),
  async (req, res, next) => {
    try {
      const retailer = await retailersService.createRetailer(req.actor!.tenantId!, req.body);
      res.status(201).json({ data: retailer });
    } catch (err) {
      next(err);
    }
  }
);

retailersRouter.patch(
  "/retailers/:id",
  authenticate,
  validateBody(updateRetailerSchema),
  async (req, res, next) => {
    try {
      const id = requireParam(req, "id");
      await assertCanUpdateRetailer(req.actor!.id, req.actor!.actorType, req.actor!.retailerId, id);
      const retailer = await retailersService.updateRetailer(req.actor!.tenantId!, id, req.body);
      res.status(200).json({ data: retailer });
    } catch (err) {
      next(err);
    }
  }
);

retailersRouter.delete("/retailers/:id", authenticate, requirePermission("retailers.manage"), async (req, res, next) => {
  try {
    await retailersService.softDeleteRetailer(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
