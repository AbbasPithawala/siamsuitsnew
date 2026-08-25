import type { Request } from "express";
import { HttpError } from "./http-error";

/** `noUncheckedIndexedAccess` types `req.params[x]` as possibly `undefined`; Express itself guarantees it's set for any param that matched the route pattern, so a miss here means a route/param name typo, not bad user input. */
export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) throw new HttpError(400, "VALIDATION_ERROR", `Missing route parameter: ${name}`);
  return value;
}
