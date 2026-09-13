import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { paginationQuerySchema, paginatedResult } from "../utils/pagination";
import * as rolesService from "../services/roles.service";

const createRoleSchema = z.object({
  name: z.string().min(1),
});

const updateRoleSchema = createRoleSchema.partial();

const assignPermissionSchema = z.object({
  permissionId: z.string().uuid(),
});

const listRolesQuerySchema = paginationQuerySchema;

/** Reads are gated by `authenticate` only; `rbac.roles.manage` gates writes, including permission assignment — same convention as `tailors.routes.ts`'s process certification. */
export const rolesRouter = Router();

rolesRouter.get("/roles", authenticate, async (req, res, next) => {
  try {
    const { page, pageSize } = listRolesQuerySchema.parse(req.query);
    const { data, total } = await rolesService.listRoles(req.actor!.tenantId!, { page, pageSize });
    res.status(200).json(paginatedResult(data, total, page, pageSize));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid query"));
      return;
    }
    next(err);
  }
});

rolesRouter.get("/roles/:id", authenticate, async (req, res, next) => {
  try {
    const role = await rolesService.getRole(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(200).json({ data: role });
  } catch (err) {
    next(err);
  }
});

rolesRouter.post(
  "/roles",
  authenticate,
  requirePermission("rbac.roles.manage"),
  validateBody(createRoleSchema),
  async (req, res, next) => {
    try {
      const role = await rolesService.createRole(req.actor!.tenantId!, req.body);
      res.status(201).json({ data: role });
    } catch (err) {
      next(err);
    }
  }
);

rolesRouter.patch(
  "/roles/:id",
  authenticate,
  requirePermission("rbac.roles.manage"),
  validateBody(updateRoleSchema),
  async (req, res, next) => {
    try {
      const role = await rolesService.updateRole(req.actor!.tenantId!, requireParam(req, "id"), req.body);
      res.status(200).json({ data: role });
    } catch (err) {
      next(err);
    }
  }
);

rolesRouter.delete("/roles/:id", authenticate, requirePermission("rbac.roles.manage"), async (req, res, next) => {
  try {
    await rolesService.softDeleteRole(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

rolesRouter.post(
  "/roles/:roleId/permissions",
  authenticate,
  requirePermission("rbac.roles.manage"),
  validateBody(assignPermissionSchema),
  async (req, res, next) => {
    try {
      const permissions = await rolesService.addPermission(req.actor!.tenantId!, requireParam(req, "roleId"), req.body.permissionId);
      res.status(201).json({ data: permissions });
    } catch (err) {
      next(err);
    }
  }
);

rolesRouter.delete(
  "/roles/:roleId/permissions/:permissionId",
  authenticate,
  requirePermission("rbac.roles.manage"),
  async (req, res, next) => {
    try {
      await rolesService.removePermission(req.actor!.tenantId!, requireParam(req, "roleId"), requireParam(req, "permissionId"));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);
