/**
 * Public product identity for canonicals, sitemaps, and Product JSON-LD.
 * A configurable child's slug points at the parent product slug.
 */
export function productCanonicalSlug(slug: string, parentSlug?: string | null): string {
  const current = slug.trim();
  const parent = parentSlug?.trim() ?? "";
  if (parent && parent !== current) return parent;
  return current;
}

export type VariantParentRow = {
  childSlug: string;
  parentSlug: string;
};

/**
 * Child slug values stored on a configurable listing payload.
 * Pass the payload property that holds each child slug. The reference store
 * used `url_key`; that name is not the default here.
 */
export function indexVariantParents(
  parentSlug: string,
  payload: string | null | undefined,
  childSlugKey: string,
): VariantParentRow[] {
  const parent = parentSlug.trim();
  if (!parent || !payload || !childSlugKey) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const variants = (parsed as { variants?: unknown }).variants;
  if (!Array.isArray(variants)) return [];
  const rows: VariantParentRow[] = [];
  for (const variant of variants) {
    if (!variant || typeof variant !== "object") continue;
    const urlKey = (variant as Record<string, unknown>)[childSlugKey];
    if (typeof urlKey !== "string") continue;
    const child = urlKey.trim();
    if (!child || child === parent) continue;
    rows.push({ childSlug: child, parentSlug: parent });
  }
  return rows;
}

export function sitemapProductSlug(slug: string, parents: ReadonlyMap<string, string>): string {
  return productCanonicalSlug(slug, parents.get(slug.trim()));
}

/**
 * Slug for Product JSON-LD `url`, `@id`, Offer `url`, and the current
 * BreadcrumbList item. A configurable child uses `canonicalSlug`.
 * A blank canonical keeps the viewed product slug.
 */
export function productJsonLdSlug(productSlug: string, canonicalSlug?: string | null): string {
  const canonical = canonicalSlug?.trim() ?? "";
  if (canonical) return canonical;
  return productSlug.trim();
}
