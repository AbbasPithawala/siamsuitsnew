import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { paginationQuerySchema, paginatedResult } from "../utils/pagination";
import * as usersService from "../services/users.service";

const createUserSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(8),
  isActive: z.boolean().optional(),
  retailerId: z.string().uuid().nullable().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
  retailerId: z.string().uuid().nullable().optional(),
});

const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
});

const listUsersQuerySchema = paginationQuerySchema;

/**
 * Reads are gated by `authenticate` only; `tenant.users.manage` gates writes, including
 * role assignment — same convention as `tailors.routes.ts`'s process certification.
 * `password` is plaintext here and hashed in `users.service.ts` before it ever touches the
 * database — never accept a pre-hashed value from a client.
 */
export const usersRouter = Router();

usersRouter.get("/users", authenticate, async (req, res, next) => {
  try {
    const { page, pageSize } = listUsersQuerySchema.parse(req.query);
    const { data, total } = await usersService.listUsers(req.actor!.tenantId!, { page, pageSize });
    res.status(200).json(paginatedResult(data, total, page, pageSize));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid query"));
      return;
    }
    next(err);
  }
});

usersRouter.get("/users/:id", authenticate, async (req, res, next) => {
  try {
    const user = await usersService.getUser(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(200).json({ data: user });
  } catch (err) {
    next(err);
  }
});

usersRouter.post(
  "/users",
  authenticate,
  requirePermission("tenant.users.manage"),
  validateBody(createUserSchema),
  async (req, res, next) => {
    try {
      const user = await usersService.createUser(req.actor!.tenantId!, req.body);
      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  }
);

usersRouter.patch(
  "/users/:id",
  authenticate,
  requirePermission("tenant.users.manage"),
  validateBody(updateUserSchema),
  async (req, res, next) => {
    try {
      const user = await usersService.updateUser(req.actor!.tenantId!, requireParam(req, "id"), req.body);
      res.status(200).json({ data: user });
    } catch (err) {
      next(err);
    }
  }
);

usersRouter.delete("/users/:id", authenticate, requirePermission("tenant.users.manage"), async (req, res, next) => {
  try {
    await usersService.softDeleteUser(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

usersRouter.post(
  "/users/:userId/roles",
  authenticate,
  requirePermission("tenant.users.manage"),
  validateBody(assignRoleSchema),
  async (req, res, next) => {
    try {
      const roles = await usersService.assignRole(req.actor!.tenantId!, requireParam(req, "userId"), req.body.roleId);
      res.status(201).json({ data: roles });
    } catch (err) {
      next(err);
    }
  }
);

usersRouter.delete(
  "/users/:userId/roles/:roleId",
  authenticate,
  requirePermission("tenant.users.manage"),
  async (req, res, next) => {
    try {
      await usersService.unassignRole(req.actor!.tenantId!, requireParam(req, "userId"), requireParam(req, "roleId"));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);
