import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { paginationQuerySchema, paginatedResult } from "../utils/pagination";
import * as extraPaymentCategoriesService from "../services/extraPaymentCategories.service";

const createExtraPaymentCategorySchema = z.object({
  productId: z.string().uuid(),
  processId: z.string().uuid(),
  featureId: z.string().uuid().optional(),
  styleId: z.string().uuid().optional(),
  name: z.string().min(1),
  thaiName: z.string().min(1).optional(),
  cost: z.string().min(1).optional(),
});

const updateExtraPaymentCategorySchema = createExtraPaymentCategorySchema.partial();

const listExtraPaymentCategoriesQuerySchema = paginationQuerySchema;

export const extraPaymentCategoriesRouter = Router();

extraPaymentCategoriesRouter.get("/extra-payment-categories", authenticate, async (req, res, next) => {
  try {
    const { page, pageSize } = listExtraPaymentCategoriesQuerySchema.parse(req.query);
    const { data, total } = await extraPaymentCategoriesService.listExtraPaymentCategories(req.actor!.tenantId!, { page, pageSize });
    res.status(200).json(paginatedResult(data, total, page, pageSize));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid query"));
      return;
    }
    next(err);
  }
});

extraPaymentCategoriesRouter.get("/extra-payment-categories/:id", authenticate, async (req, res, next) => {
  try {
    const category = await extraPaymentCategoriesService.getExtraPaymentCategory(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(200).json({ data: category });
  } catch (err) {
    next(err);
  }
});

extraPaymentCategoriesRouter.post(
  "/extra-payment-categories",
  authenticate,
  requirePermission("factory.extra_payments.manage"),
  validateBody(createExtraPaymentCategorySchema),
  async (req, res, next) => {
    try {
      const category = await extraPaymentCategoriesService.createExtraPaymentCategory(req.actor!.tenantId!, req.body);
      res.status(201).json({ data: category });
    } catch (err) {
      next(err);
    }
  }
);

extraPaymentCategoriesRouter.patch(
  "/extra-payment-categories/:id",
  authenticate,
  requirePermission("factory.extra_payments.manage"),
  validateBody(updateExtraPaymentCategorySchema),
  async (req, res, next) => {
    try {
      const category = await extraPaymentCategoriesService.updateExtraPaymentCategory(
        req.actor!.tenantId!,
        requireParam(req, "id"),
        req.body
      );
      res.status(200).json({ data: category });
    } catch (err) {
      next(err);
    }
  }
);

extraPaymentCategoriesRouter.delete(
  "/extra-payment-categories/:id",
  authenticate,
  requirePermission("factory.extra_payments.manage"),
  async (req, res, next) => {
    try {
      await extraPaymentCategoriesService.softDeleteExtraPaymentCategory(req.actor!.tenantId!, requireParam(req, "id"));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);
