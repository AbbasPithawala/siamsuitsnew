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
  // When set, the server also serves the built client SPA (and falls back to its
  // index.html for unmatched non-API GET routes) from this directory — enabling a
  // single-process deploy instead of hosting client/dist separately (e.g. behind a CDN).
  // Path is resolved relative to the server process's cwd if not absolute. Unset by
  // default: dev runs the client via its own Vite dev server instead.
  CLIENT_DIST_PATH: z.string().optional(),
  // The client app's own base URL (e.g. `https://app.example.com`) — used only to build a
  // login link inside `sendTenantWelcomeEmail()`. Distinct from `PUBLIC_BASE_URL` above,
  // which is this *server's* own asset-serving base URL, a different concern. Optional, same
  // degrade-gracefully posture as every other env var here.
  CLIENT_APP_URL: z.string().optional(),
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
