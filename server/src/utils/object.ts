/** Drops `keys` from `obj`, preserving the optional/required modifiers of the remaining keys (unlike manually re-listing fields, which `exactOptionalPropertyTypes` would otherwise force to `T | undefined`). */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) delete result[key];
  return result;
}
