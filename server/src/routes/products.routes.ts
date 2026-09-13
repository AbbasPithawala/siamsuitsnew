import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { optionalPaginationQuerySchema, paginatedResult, resolveOptionalPagination } from "../utils/pagination";
import * as productsService from "../services/products.service";

const createProductSchema = z.object({
  name: z.string().min(1),
  thaiName: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
  measurementDiagramImage: z.string().min(1).optional(),
});

const updateProductSchema = createProductSchema.partial();

const listProductsQuerySchema = optionalPaginationQuerySchema;

/**
 * Reads are gated by `authenticate` only — there's no `catalog.*.view` permission in the
 * seeded catalog (only `catalog.*.manage`), and browsing the catalog (e.g. to build an
 * order) is expected of any logged-in staff/retailer user. Writes require the module's
 * `.manage` permission.
 */
export const productsRouter = Router();

productsRouter.get("/products", authenticate, async (req, res, next) => {
  try {
    const query = listProductsQuerySchema.parse(req.query);
    const pagination = resolveOptionalPagination(query);
    if (pagination) {
      const { data, total } = await productsService.listProducts(req.actor!.tenantId!, pagination);
      res.status(200).json(paginatedResult(data, total, pagination.page, pagination.pageSize));
    } else {
      const data = await productsService.listProducts(req.actor!.tenantId!);
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

productsRouter.get("/products/:id", authenticate, async (req, res, next) => {
  try {
    const product = await productsService.getProduct(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(200).json({ data: product });
  } catch (err) {
    next(err);
  }
});

productsRouter.post(
  "/products",
  authenticate,
  requirePermission("catalog.products.manage"),
  validateBody(createProductSchema),
  async (req, res, next) => {
    try {
      const product = await productsService.createProduct(req.actor!.tenantId!, req.body);
      res.status(201).json({ data: product });
    } catch (err) {
      next(err);
    }
  }
);

productsRouter.patch(
  "/products/:id",
  authenticate,
  requirePermission("catalog.products.manage"),
  validateBody(updateProductSchema),
  async (req, res, next) => {
    try {
      const product = await productsService.updateProduct(req.actor!.tenantId!, requireParam(req, "id"), req.body);
      res.status(200).json({ data: product });
    } catch (err) {
      next(err);
    }
  }
);

productsRouter.delete("/products/:id", authenticate, requirePermission("catalog.products.manage"), async (req, res, next) => {
  try {
    await productsService.softDeleteProduct(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
