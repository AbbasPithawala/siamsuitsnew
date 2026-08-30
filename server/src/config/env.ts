import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4545),
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgres://")),
  JWT_SECRET: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  STORAGE_LOCAL_DIR: z.string().default("uploads"),
  PUBLIC_BASE_URL: z.string().optional(),
  // Retailer-invoice "Resend" email (`email.service.ts`) — all optional, same
  // degrade-gracefully posture as the AWS vars above: `hasSmtpConfig()` gates whether the
  // feature is actually available, rather than failing at startup when it's simply unset in
  // dev/test. Deliberately env-configured, not a hardcoded account (legacy's real
  // `routes.retailerInvoices.js` had a live Gmail address + app password committed directly
  // in the route file — not something this rewrite carries forward).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

export const env = envSchema.parse(process.env);
