import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index";
import { tailors, tenants } from "../db/schema/index";
import { issueToken, verifyPassword } from "../services/auth.service";
import { HttpError } from "../utils/http-error";

const loginSchema = z.object({
  tenant: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});

export const tailorRouter = Router();

tailorRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);

    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, body.tenant) });
    const tailor = tenant
      ? await db.query.tailors.findFirst({
          where: and(eq(tailors.tenantId, tenant.id), eq(tailors.username, body.username)),
        })
      : undefined;

    const passwordOk = tailor ? await verifyPassword(body.password, tailor.passwordHash) : false;

    if (!tenant || !tailor || !tailor.isActive || !passwordOk) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    const token = issueToken({ sub: tailor.id, tenantId: tailor.tenantId, actorType: "tailor" });
    res.status(200).json({ data: { token } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid request"));
      return;
    }
    next(err);
  }
});
