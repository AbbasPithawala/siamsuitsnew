import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { optionalPaginationQuerySchema, paginatedResult, resolveOptionalPagination } from "../utils/pagination";
import * as measurementsService from "../services/measurements.service";

const createDefinitionSchema = z.object({
  name: z.string().min(1),
  thaiName: z.string().min(1).optional(),
  slug: z.string().min(1),
});

const updateDefinitionSchema = createDefinitionSchema.partial();

const linksSchema = z.object({
  measurementDefinitionIds: z.array(z.string().uuid()),
});

const listMeasurementDefinitionsQuerySchema = optionalPaginationQuerySchema;

export const measurementsRouter = Router();

measurementsRouter.get("/measurement-definitions", authenticate, async (req, res, next) => {
  try {
    const query = listMeasurementDefinitionsQuerySchema.parse(req.query);
    const pagination = resolveOptionalPagination(query);
    if (pagination) {
      const { data, total } = await measurementsService.listMeasurementDefinitions(req.actor!.tenantId!, pagination);
      res.status(200).json(paginatedResult(data, total, pagination.page, pagination.pageSize));
    } else {
      const data = await measurementsService.listMeasurementDefinitions(req.actor!.tenantId!);
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

measurementsRouter.get("/measurement-definitions/:id", authenticate, async (req, res, next) => {
  try {
    const definition = await measurementsService.getMeasurementDefinition(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(200).json({ data: definition });
  } catch (err) {
    next(err);
  }
});

measurementsRouter.post(
  "/measurement-definitions",
  authenticate,
  requirePermission("catalog.measurements.manage"),
  validateBody(createDefinitionSchema),
  async (req, res, next) => {
    try {
      const definition = await measurementsService.createMeasurementDefinition(req.actor!.tenantId!, req.body);
      res.status(201).json({ data: definition });
    } catch (err) {
      next(err);
    }
  }
);

measurementsRouter.patch(
  "/measurement-definitions/:id",
  authenticate,
  requirePermission("catalog.measurements.manage"),
  validateBody(updateDefinitionSchema),
  async (req, res, next) => {
    try {
      const definition = await measurementsService.updateMeasurementDefinition(req.actor!.tenantId!, requireParam(req, "id"), req.body);
      res.status(200).json({ data: definition });
    } catch (err) {
      next(err);
    }
  }
);

measurementsRouter.delete(
  "/measurement-definitions/:id",
  authenticate,
  requirePermission("catalog.measurements.manage"),
  async (req, res, next) => {
    try {
      await measurementsService.softDeleteMeasurementDefinition(req.actor!.tenantId!, requireParam(req, "id"));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

measurementsRouter.get("/products/:productId/measurements", authenticate, async (req, res, next) => {
  try {
    const links = await measurementsService.getProductMeasurements(req.actor!.tenantId!, requireParam(req, "productId"));
    res.status(200).json({ data: links });
  } catch (err) {
    next(err);
  }
});

measurementsRouter.put(
  "/products/:productId/measurements",
  authenticate,
  requirePermission("catalog.measurements.manage"),
  validateBody(linksSchema),
  async (req, res, next) => {
    try {
      const links = await measurementsService.setProductMeasurements(
        req.actor!.tenantId!,
        requireParam(req, "productId"),
        req.body.measurementDefinitionIds
      );
      res.status(200).json({ data: links });
    } catch (err) {
      next(err);
    }
  }
);
