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
});

export const env = envSchema.parse(process.env);
