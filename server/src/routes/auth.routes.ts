import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index";
import { tenants, users } from "../db/schema/index";
import { issueToken, verifyPassword } from "../services/auth.service";
import { HttpError } from "../utils/http-error";

const loginSchema = z.object({
  tenant: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);

    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, body.tenant) });
    const user = tenant
      ? await db.query.users.findFirst({
          where: and(eq(users.tenantId, tenant.id), eq(users.username, body.username)),
        })
      : undefined;

    const passwordOk = user ? await verifyPassword(body.password, user.passwordHash) : false;

    if (!tenant || !tenant.isActive || !user || !user.isActive || !passwordOk) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    const token = issueToken({ sub: user.id, tenantId: user.tenantId, actorType: "user" });
    res.status(200).json({ data: { token } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid request"));
      return;
    }
    next(err);
  }
});
