import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { requireParam } from "../utils/params";
import * as fittingsService from "../services/fittings.service";

const createFittingSchema = z.object({
  name: z.string().min(1),
  thaiName: z.string().min(1).optional(),
});

const updateFittingSchema = createFittingSchema.partial();

const setValuesSchema = z.object({
  values: z.array(
    z.object({
      measurementDefinitionId: z.string().uuid(),
      value: z.string().min(1),
    })
  ),
});

export const fittingsRouter = Router();

fittingsRouter.get("/products/:productId/fittings", authenticate, async (req, res, next) => {
  try {
    const list = await fittingsService.listFittingsForProduct(req.actor!.tenantId!, requireParam(req, "productId"));
    res.status(200).json({ data: list });
  } catch (err) {
    next(err);
  }
});

fittingsRouter.post(
  "/products/:productId/fittings",
  authenticate,
  requirePermission("catalog.fittings.manage"),
  validateBody(createFittingSchema),
  async (req, res, next) => {
    try {
      const fitting = await fittingsService.createFitting(req.actor!.tenantId!, requireParam(req, "productId"), req.body);
      res.status(201).json({ data: fitting });
    } catch (err) {
      next(err);
    }
  }
);

fittingsRouter.get("/fittings/:id", authenticate, async (req, res, next) => {
  try {
    const fitting = await fittingsService.getFitting(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(200).json({ data: fitting });
  } catch (err) {
    next(err);
  }
});

fittingsRouter.put(
  "/fittings/:id",
  authenticate,
  requirePermission("catalog.fittings.manage"),
  validateBody(updateFittingSchema),
  async (req, res, next) => {
    try {
      const fitting = await fittingsService.updateFitting(req.actor!.tenantId!, requireParam(req, "id"), req.body);
      res.status(200).json({ data: fitting });
    } catch (err) {
      next(err);
    }
  }
);

fittingsRouter.delete("/fittings/:id", authenticate, requirePermission("catalog.fittings.manage"), async (req, res, next) => {
  try {
    await fittingsService.softDeleteFitting(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

fittingsRouter.put(
  "/fittings/:id/values",
  authenticate,
  requirePermission("catalog.fittings.manage"),
  validateBody(setValuesSchema),
  async (req, res, next) => {
    try {
      const values = await fittingsService.setFittingValues(req.actor!.tenantId!, requireParam(req, "id"), req.body.values);
      res.status(200).json({ data: values });
    } catch (err) {
      next(err);
    }
  }
);
