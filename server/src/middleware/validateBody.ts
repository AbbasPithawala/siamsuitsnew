import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { HttpError } from "../utils/http-error";

/** Parses/validates `req.body` against `schema`, replacing it with the parsed value on success. */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new HttpError(400, "VALIDATION_ERROR", result.error.issues[0]?.message ?? "Invalid request"));
      return;
    }
    req.body = result.data;
    next();
  };
}
