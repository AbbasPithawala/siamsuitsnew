import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index";
import { platformAdmins } from "../db/schema/index";
import { issueToken, verifyPassword } from "../services/auth.service";
import { HttpError } from "../utils/http-error";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const platformAuthRouter = Router();

/** Structural copy of `tailor.routes.ts`'s login route — no `tenant` field: platform admins aren't tenant members. */
platformAuthRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);

    const platformAdmin = await db.query.platformAdmins.findFirst({ where: eq(platformAdmins.username, body.username) });
    const passwordOk = platformAdmin ? await verifyPassword(body.password, platformAdmin.passwordHash) : false;

    if (!platformAdmin || !platformAdmin.isActive || !passwordOk) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    const token = issueToken({ sub: platformAdmin.id, tenantId: null, actorType: "platform_admin" });
    res.status(200).json({ data: { token } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid request"));
      return;
    }
    next(err);
  }
});
