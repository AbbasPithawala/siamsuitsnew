import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { optionalPaginationQuerySchema, paginatedResult, resolveOptionalPagination } from "../utils/pagination";
import * as superProductsService from "../services/superProducts.service";

const componentSchema = z.object({
  productId: z.string().uuid(),
  slotLabel: z.string().min(1),
  sequence: z.number().int().positive().optional(),
});

const createSuperProductSchema = z.object({
  name: z.string().min(1),
  thaiName: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
  components: z.array(componentSchema).max(3).optional(),
});

const updateSuperProductSchema = createSuperProductSchema.pick({ name: true, thaiName: true, image: true }).partial();

const updateComponentSchema = componentSchema.partial();

const listSuperProductsQuerySchema = optionalPaginationQuerySchema;

export const superProductsRouter = Router();

superProductsRouter.get("/super-products", authenticate, async (req, res, next) => {
  try {
    const query = listSuperProductsQuerySchema.parse(req.query);
    const pagination = resolveOptionalPagination(query);
    if (pagination) {
      const { data, total } = await superProductsService.listSuperProducts(req.actor!.tenantId, pagination);
      res.status(200).json(paginatedResult(data, total, pagination.page, pagination.pageSize));
    } else {
      const data = await superProductsService.listSuperProducts(req.actor!.tenantId);
      res.status(200).json({ data });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid query"));
      return;
    }
    next(err);
  }
});

superProductsRouter.get("/super-products/:id", authenticate, async (req, res, next) => {
  try {
    const superProduct = await superProductsService.getSuperProduct(req.actor!.tenantId, requireParam(req, "id"));
    res.status(200).json({ data: superProduct });
  } catch (err) {
    next(err);
  }
});

superProductsRouter.post(
  "/super-products",
  authenticate,
  requirePermission("catalog.super_products.manage"),
  validateBody(createSuperProductSchema),
  async (req, res, next) => {
    try {
      const superProduct = await superProductsService.createSuperProduct(req.actor!.tenantId, req.body);
      res.status(201).json({ data: superProduct });
    } catch (err) {
      next(err);
    }
  }
);

superProductsRouter.patch(
  "/super-products/:id",
  authenticate,
  requirePermission("catalog.super_products.manage"),
  validateBody(updateSuperProductSchema),
  async (req, res, next) => {
    try {
      const superProduct = await superProductsService.updateSuperProduct(req.actor!.tenantId, requireParam(req, "id"), req.body);
      res.status(200).json({ data: superProduct });
    } catch (err) {
      next(err);
    }
  }
);

superProductsRouter.delete(
  "/super-products/:id",
  authenticate,
  requirePermission("catalog.super_products.manage"),
  async (req, res, next) => {
    try {
      await superProductsService.softDeleteSuperProduct(req.actor!.tenantId, requireParam(req, "id"));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

superProductsRouter.post(
  "/super-products/:id/components",
  authenticate,
  requirePermission("catalog.super_products.manage"),
  validateBody(componentSchema),
  async (req, res, next) => {
    try {
      const components = await superProductsService.addComponent(req.actor!.tenantId, requireParam(req, "id"), req.body);
      res.status(201).json({ data: components });
    } catch (err) {
      next(err);
    }
  }
);

superProductsRouter.patch(
  "/super-products/:id/components/:componentId",
  authenticate,
  requirePermission("catalog.super_products.manage"),
  validateBody(updateComponentSchema),
  async (req, res, next) => {
    try {
      const components = await superProductsService.updateComponent(
        req.actor!.tenantId,
        requireParam(req, "id"),
        requireParam(req, "componentId"),
        req.body
      );
      res.status(200).json({ data: components });
    } catch (err) {
      next(err);
    }
  }
);

superProductsRouter.delete(
  "/super-products/:id/components/:componentId",
  authenticate,
  requirePermission("catalog.super_products.manage"),
  async (req, res, next) => {
    try {
      await superProductsService.removeComponent(req.actor!.tenantId, requireParam(req, "id"), requireParam(req, "componentId"));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);
