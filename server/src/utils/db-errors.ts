import { HttpError } from "./http-error";

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === UNIQUE_VIOLATION;
}

/** Maps a Postgres unique-constraint violation (e.g. tenant+name uniqueness) to a 409 HttpError. */
export async function catchUniqueViolation<T>(fn: () => Promise<T>, code: string, message: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, code, message);
    }
    throw err;
  }
}
