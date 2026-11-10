/** Mirrors the `slug` Phase 2 generated for `measurement_definitions` (lowercased, spaces to underscores). */
export function slugifyMeasurementName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

/**
 * Derives a tenant slug from a business name — lowercased, non-alphanumeric runs collapsed to a
 * single hyphen, leading/trailing hyphens trimmed — matching the `^[a-z0-9-]+$` shape tenant
 * slugs have always been validated against (login routing, welcome emails, etc). Falls back to
 * `"tenant"` for a name with no alphanumeric characters at all, so the result is never empty.
 */
export function slugifyBusinessName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "tenant";
}
