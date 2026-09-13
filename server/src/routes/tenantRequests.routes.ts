import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePlatformAdmin } from "../middleware/requirePlatformAdmin";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { paginationQuerySchema, paginatedResult } from "../utils/pagination";
import * as tenantRequestsService from "../services/tenantRequests.service";
import { sendTenantWelcomeEmail } from "../services/email.service";

const createTenantRequestSchema = z.object({
  businessName: z.string().min(1),
  contactName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  requestedSlug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "requestedSlug must contain only lowercase letters, numbers, and hyphens"),
  notes: z.string().optional(),
});

const listTenantRequestsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

const approveTenantRequestSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),
  plan: z.string().optional(),
  logo: z.string().optional(),
  address: z.string().optional(),
  invoiceFooterText: z.string().optional(),
});

const rejectTenantRequestSchema = z.object({
  reason: z.string().min(1),
});

export const tenantRequestsRouter = Router();

/**
 * Genuinely public — the one deliberately unauthenticated write endpoint in this API
 * (PHASE_11_TASKS.md Workstream B Group 1): a tenant doesn't exist yet for the requester to
 * authenticate against. No rate-limiting/spam guard is built this phase (flagged, not
 * built — no rate-limiting middleware exists anywhere in this codebase to extend).
 */
tenantRequestsRouter.post("/tenant-requests", validateBody(createTenantRequestSchema), async (req, res, next) => {
  try {
    const request = await tenantRequestsService.createTenantRequest(req.body);
    res.status(201).json({ data: request });
  } catch (err) {
    next(err);
  }
});

tenantRequestsRouter.get("/tenant-requests", authenticate, requirePlatformAdmin, async (req, res, next) => {
  try {
    const { page, pageSize, status } = listTenantRequestsQuerySchema.parse(req.query);
    const { data, total } = await tenantRequestsService.listTenantRequests({ page, pageSize }, status);
    res.status(200).json(paginatedResult(data, total, page, pageSize));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid query"));
      return;
    }
    next(err);
  }
});

tenantRequestsRouter.get("/tenant-requests/:id", authenticate, requirePlatformAdmin, async (req, res, next) => {
  try {
    const request = await tenantRequestsService.getTenantRequest(requireParam(req, "id"));
    res.status(200).json({ data: request });
  } catch (err) {
    next(err);
  }
});

/**
 * PHASE_11_TASKS.md Workstream C Group 1 / C4: the welcome email is sent in its own
 * `try/catch` after `approveTenantRequest()`'s DB work has already committed — an email
 * failure (the expected `503 EMAIL_NOT_CONFIGURED` in dev/test) never rolls back or fails
 * the approval. `emailSent` plus the real generated credentials are always in the response,
 * so a superadmin without SMTP configured can still relay them manually.
 */
tenantRequestsRouter.post(
  "/tenant-requests/:id/approve",
  authenticate,
  requirePlatformAdmin,
  validateBody(approveTenantRequestSchema),
  async (req, res, next) => {
    try {
      const result = await tenantRequestsService.approveTenantRequest(requireParam(req, "id"), req.actor!.id, req.body);

      let emailSent = false;
      try {
        await sendTenantWelcomeEmail({
          to: result.request.email,
          tenantSlug: result.tenant.slug,
          username: result.ownerUser.username,
          tempPassword: result.tempPassword,
        });
        emailSent = true;
      } catch {
        emailSent = false;
      }

      res.status(200).json({
        data: {
          request: result.request,
          tenant: result.tenant,
          ownerUser: result.ownerUser,
          tempPassword: result.tempPassword,
          emailSent,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

tenantRequestsRouter.post(
  "/tenant-requests/:id/reject",
  authenticate,
  requirePlatformAdmin,
  validateBody(rejectTenantRequestSchema),
  async (req, res, next) => {
    try {
      const { reason } = req.body as z.infer<typeof rejectTenantRequestSchema>;
      const request = await tenantRequestsService.rejectTenantRequest(requireParam(req, "id"), req.actor!.id, reason);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }
);
