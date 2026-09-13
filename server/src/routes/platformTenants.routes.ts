import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePlatformAdmin } from "../middleware/requirePlatformAdmin";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { paginationQuerySchema, paginatedResult } from "../utils/pagination";
import * as platformTenantsService from "../services/platformTenants.service";

const slugSchema = z.string().regex(/^[a-z0-9-]+$/, "slug must contain only lowercase letters, numbers, and hyphens");

const createTenantSchema = z.object({
  businessName: z.string().min(1),
  slug: slugSchema,
  ownerName: z.string().min(1),
  ownerEmail: z.string().email(),
  plan: z.string().optional(),
  logo: z.string().optional(),
  address: z.string().optional(),
  invoiceFooterText: z.string().optional(),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  slug: slugSchema.optional(),
  plan: z.string().optional(),
  logo: z.string().optional(),
  address: z.string().optional(),
  invoiceFooterText: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const platformTenantsRouter = Router();

platformTenantsRouter.get("/tenants", authenticate, requirePlatformAdmin, async (req, res, next) => {
  try {
    const { page, pageSize } = paginationQuerySchema.parse(req.query);
    const { data, total } = await platformTenantsService.listTenants({ page, pageSize });
    res.status(200).json(paginatedResult(data, total, page, pageSize));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid query"));
      return;
    }
    next(err);
  }
});

platformTenantsRouter.post(
  "/tenants",
  authenticate,
  requirePlatformAdmin,
  validateBody(createTenantSchema),
  async (req, res, next) => {
    try {
      const result = await platformTenantsService.createTenant(req.body);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

platformTenantsRouter.patch(
  "/tenants/:id",
  authenticate,
  requirePlatformAdmin,
  validateBody(updateTenantSchema),
  async (req, res, next) => {
    try {
      const tenant = await platformTenantsService.updateTenant(requireParam(req, "id"), req.body);
      res.status(200).json({ data: tenant });
    } catch (err) {
      next(err);
    }
  }
);
