import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "12h";

export type ActorType = "user" | "tailor" | "platform_admin";

const tokenPayloadSchema = z.object({
  sub: z.string(),
  tenantId: z.string().nullable(),
  actorType: z.enum(["user", "tailor", "platform_admin"]),
});

export type TokenPayload = z.infer<typeof tokenPayloadSchema>;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function issueToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  return tokenPayloadSchema.parse(decoded);
}

/** A real credential that gets emailed to a stranger (`provisionTenant()`) — `crypto.randomBytes`, not `Math.random()`. */
export function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}
