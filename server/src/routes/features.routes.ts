import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { optionalPaginationQuerySchema, paginatedResult, resolveOptionalPagination } from "../utils/pagination";
import * as featuresService from "../services/features.service";

const createFeatureSchema = z.object({
  name: z.string().min(1),
  thaiName: z.string().min(1).optional(),
  type: z.enum(["choice", "text", "structured"]),
  processId: z.string().uuid().optional(),
  productIds: z.array(z.string().uuid()).optional(),
  isAdditional: z.boolean().optional(),
});

const updateFeatureSchema = createFeatureSchema
  .pick({ name: true, thaiName: true, type: true, processId: true, isAdditional: true })
  .partial();

const productsLinkSchema = z.object({
  productIds: z.array(z.string().uuid()),
});

const featuresLinkSchema = z.object({
  featureIds: z.array(z.string().uuid()),
});

const createStyleSchema = z.object({
  name: z.string().min(1),
  thaiName: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
  price: z.string().min(1).optional(),
  workerPrice: z.string().min(1).optional(),
});

const updateStyleSchema = createStyleSchema.partial();

const createStyleOptionSchema = z.object({
  name: z.string().min(1),
  image: z.string().min(1).optional(),
});

const updateStyleOptionSchema = createStyleOptionSchema.partial();

const listFeaturesQuerySchema = z
  .object({
    productId: z.string().uuid().optional(),
  })
  .merge(optionalPaginationQuerySchema);

export const featuresRouter = Router();

/**
 * The `productId`-filtered branch (Workstream A) stays fully unpaginated, always — any
 * `page`/`pageSize` sent alongside `productId` is simply ignored, matching
 * `features.service.ts#listFeaturesInTx`'s own posture. Pagination only ever applies to
 * the "every tenant feature" branch, opt-in, per Workstream C.
 */
featuresRouter.get("/features", authenticate, async (req, res, next) => {
  try {
    const query = listFeaturesQuerySchema.parse(req.query);
    if (query.productId) {
      const list = await featuresService.listFeatures(req.actor!.tenantId, { productId: query.productId });
      res.status(200).json({ data: list });
      return;
    }

    const pagination = resolveOptionalPagination(query);
    if (pagination) {
      const { data, total } = await featuresService.listFeatures(req.actor!.tenantId, {}, pagination);
      res.status(200).json(paginatedResult(data, total, pagination.page, pagination.pageSize));
    } else {
      const data = await featuresService.listFeatures(req.actor!.tenantId);
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

featuresRouter.get("/features/:id", authenticate, async (req, res, next) => {
  try {
    const feature = await featuresService.getFeature(req.actor!.tenantId, requireParam(req, "id"));
    res.status(200).json({ data: feature });
  } catch (err) {
    next(err);
  }
});

featuresRouter.post(
  "/features",
  authenticate,
  requirePermission("catalog.features.manage"),
  validateBody(createFeatureSchema),
  async (req, res, next) => {
    try {
      const feature = await featuresService.createFeature(req.actor!.tenantId, req.body);
      res.status(201).json({ data: feature });
    } catch (err) {
      next(err);
    }
  }
);

featuresRouter.patch(
  "/features/:id",
  authenticate,
  requirePermission("catalog.features.manage"),
  validateBody(updateFeatureSchema),
  async (req, res, next) => {
    try {
      const feature = await featuresService.updateFeature(req.actor!.tenantId, requireParam(req, "id"), req.body);
      res.status(200).json({ data: feature });
    } catch (err) {
      next(err);
    }
  }
);

featuresRouter.delete("/features/:id", authenticate, requirePermission("catalog.features.manage"), async (req, res, next) => {
  try {
    await featuresService.softDeleteFeature(req.actor!.tenantId, requireParam(req, "id"));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

featuresRouter.put(
  "/features/:id/products",
  authenticate,
  requirePermission("catalog.features.manage"),
  validateBody(productsLinkSchema),
  async (req, res, next) => {
    try {
      const feature = await featuresService.setFeatureProducts(req.actor!.tenantId, requireParam(req, "id"), req.body.productIds);
      res.status(200).json({ data: feature });
    } catch (err) {
      next(err);
    }
  }
);

featuresRouter.put(
  "/products/:productId/features",
  authenticate,
  requirePermission("catalog.features.manage"),
  validateBody(featuresLinkSchema),
  async (req, res, next) => {
    try {
      const features = await featuresService.setProductFeatures(req.actor!.tenantId, requireParam(req, "productId"), req.body.featureIds);
      res.status(200).json({ data: features });
    } catch (err) {
      next(err);
    }
  }
);

featuresRouter.post(
  "/features/:id/styles",
  authenticate,
  requirePermission("catalog.features.manage"),
  validateBody(createStyleSchema),
  async (req, res, next) => {
    try {
      const style = await featuresService.createStyle(req.actor!.tenantId, requireParam(req, "id"), req.body);
      res.status(201).json({ data: style });
    } catch (err) {
      next(err);
    }
  }
);

featuresRouter.patch(
  "/styles/:styleId",
  authenticate,
  requirePermission("catalog.features.manage"),
  validateBody(updateStyleSchema),
  async (req, res, next) => {
    try {
      const style = await featuresService.updateStyle(req.actor!.tenantId, requireParam(req, "styleId"), req.body);
      res.status(200).json({ data: style });
    } catch (err) {
      next(err);
    }
  }
);

featuresRouter.delete("/styles/:styleId", authenticate, requirePermission("catalog.features.manage"), async (req, res, next) => {
  try {
    await featuresService.softDeleteStyle(req.actor!.tenantId, requireParam(req, "styleId"));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

featuresRouter.post(
  "/styles/:styleId/options",
  authenticate,
  requirePermission("catalog.features.manage"),
  validateBody(createStyleOptionSchema),
  async (req, res, next) => {
    try {
      const option = await featuresService.createStyleOption(req.actor!.tenantId, requireParam(req, "styleId"), req.body);
      res.status(201).json({ data: option });
    } catch (err) {
      next(err);
    }
  }
);

featuresRouter.patch(
  "/style-options/:optionId",
  authenticate,
  requirePermission("catalog.features.manage"),
  validateBody(updateStyleOptionSchema),
  async (req, res, next) => {
    try {
      const option = await featuresService.updateStyleOption(req.actor!.tenantId, requireParam(req, "optionId"), req.body);
      res.status(200).json({ data: option });
    } catch (err) {
      next(err);
    }
  }
);

featuresRouter.delete(
  "/style-options/:optionId",
  authenticate,
  requirePermission("catalog.features.manage"),
  async (req, res, next) => {
    try {
      await featuresService.softDeleteStyleOption(req.actor!.tenantId, requireParam(req, "optionId"));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);
