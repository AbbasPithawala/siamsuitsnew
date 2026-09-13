import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { optionalPaginationQuerySchema, paginatedResult, resolveOptionalPagination } from "../utils/pagination";
import * as processesService from "../services/processes.service";

const createProcessSchema = z.object({
  name: z.string().min(1),
  thaiName: z.string().min(1).optional(),
  price: z.string().min(1).optional(),
});

const updateProcessSchema = createProcessSchema.partial();

const sequenceSchema = z.object({
  processIds: z.array(z.string().uuid()),
});

const listProcessesQuerySchema = optionalPaginationQuerySchema;

export const processesRouter = Router();

processesRouter.get("/processes", authenticate, async (req, res, next) => {
  try {
    const query = listProcessesQuerySchema.parse(req.query);
    const pagination = resolveOptionalPagination(query);
    if (pagination) {
      const { data, total } = await processesService.listProcesses(req.actor!.tenantId!, pagination);
      res.status(200).json(paginatedResult(data, total, pagination.page, pagination.pageSize));
    } else {
      const data = await processesService.listProcesses(req.actor!.tenantId!);
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

processesRouter.get("/processes/:id", authenticate, async (req, res, next) => {
  try {
    const process = await processesService.getProcess(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(200).json({ data: process });
  } catch (err) {
    next(err);
  }
});

processesRouter.post(
  "/processes",
  authenticate,
  requirePermission("catalog.processes.manage"),
  validateBody(createProcessSchema),
  async (req, res, next) => {
    try {
      const process = await processesService.createProcess(req.actor!.tenantId!, req.body);
      res.status(201).json({ data: process });
    } catch (err) {
      next(err);
    }
  }
);

processesRouter.patch(
  "/processes/:id",
  authenticate,
  requirePermission("catalog.processes.manage"),
  validateBody(updateProcessSchema),
  async (req, res, next) => {
    try {
      const process = await processesService.updateProcess(req.actor!.tenantId!, requireParam(req, "id"), req.body);
      res.status(200).json({ data: process });
    } catch (err) {
      next(err);
    }
  }
);

processesRouter.delete("/processes/:id", authenticate, requirePermission("catalog.processes.manage"), async (req, res, next) => {
  try {
    await processesService.softDeleteProcess(req.actor!.tenantId!, requireParam(req, "id"));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

processesRouter.get("/products/:productId/processes", authenticate, async (req, res, next) => {
  try {
    const sequence = await processesService.getProductProcessSequenceForProduct(req.actor!.tenantId!, requireParam(req, "productId"));
    res.status(200).json({ data: sequence });
  } catch (err) {
    next(err);
  }
});

processesRouter.put(
  "/products/:productId/processes",
  authenticate,
  requirePermission("catalog.processes.manage"),
  validateBody(sequenceSchema),
  async (req, res, next) => {
    try {
      const sequence = await processesService.setProductProcessSequence(
        req.actor!.tenantId!,
        requireParam(req, "productId"),
        req.body.processIds
      );
      res.status(200).json({ data: sequence });
    } catch (err) {
      next(err);
    }
  }
);
