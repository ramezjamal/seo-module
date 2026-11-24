import type { NormalizedSeoOptions } from "./options.js";

/** Existing sitemap generation window. Not an approved freshness SLA. */
export const sitemapRevalidateSeconds = 3600;

/** Existing 503 retry window. Not an approved freshness SLA. */
export const failureRetryAfterSeconds = 120;

/** On-demand sitemap refresh. Not a purge-all tag. */
export const sitemapCacheTag = "seo:sitemap";

const MAX_TAG_LENGTH = 180;
const MAX_PATH_LENGTH = 300;
const REVALIDATION_WINDOW_MS = 60_000;
const REVALIDATION_MAX_PER_WINDOW = 60;

export type PublicCacheIdentity = {
  origin: string;
  locale: string;
  storeView: string;
  entity: string;
  page?: number | null;
  currency?: string | null;
};

/**
 * Public data cache identity. Locale and store view are separate parts.
 * Authorization, cookies, and session tokens are not accepted.
 */
export function publicCacheKey(
  identity: PublicCacheIdentity,
  options: NormalizedSeoOptions,
): string {
  const origin = identity.origin.trim();
  const entity = identity.entity.trim();
  const storeView = identity.storeView.trim();
  if (!origin || !entity || !storeView) {
    throw new Error("Public cache identity is incomplete.");
  }
  if (!options.locales.has(identity.locale)) {
    throw new Error("Public cache identity locale is not a configured locale.");
  }
  const page = identity.page == null ? 1 : identity.page;
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("Public cache identity page is invalid.");
  }
  const currency = identity.currency?.trim() || "-";
  return [origin, identity.locale, storeView, entity, `page:${page}`, `currency:${currency}`].join(
    "|",
  );
}

/** Store-view code that separates catalog reads for a locale. */
export function storeViewForPublicCache(locale: string, options: NormalizedSeoOptions): string {
  return options.storeViewByLocale[locale] ?? locale;
}

/**
 * Whether a cache tag should refresh the sitemap.
 * The exact `seo:sitemap` tag always matches. Other tags match configured prefixes.
 * The reference prefixes were catalog-system names and are not included.
 */
export function refreshesSitemap(tag: string, options: NormalizedSeoOptions): boolean {
  if (tag === sitemapCacheTag) return true;
  return options.sitemapTagPrefixes.some((prefix) => prefix.length > 0 && tag.startsWith(prefix));
}

export function isScopedTag(tag: string): boolean {
  return tag.length > 0 && tag.length <= MAX_TAG_LENGTH && !tag.includes("*") && !tag.includes(" ");
}

export function isScopedPath(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("://") &&
    !path.includes("*") &&
    !path.includes(" ") &&
    path.length <= MAX_PATH_LENGTH
  );
}

/**
 * Rate limit for on-demand revalidation.
 * The window filter is the part required by the captured return: `recent[0]`
 * is the oldest hit still inside the one-minute window.
 */
export function takeRevalidationSlot(
  now: number,
  hits: readonly number[],
): { allowed: boolean; retryAfterSeconds: number; hits: number[] } {
  const recent = hits
    .filter((hit) => now - hit < REVALIDATION_WINDOW_MS && now - hit >= 0)
    .sort((left, right) => left - right);
  if (recent.length >= REVALIDATION_MAX_PER_WINDOW) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((recent[0]! + REVALIDATION_WINDOW_MS - now) / 1000),
    );
    return { allowed: false, retryAfterSeconds, hits: recent };
  }
  return { allowed: true, retryAfterSeconds: 0, hits: [...recent, now] };
}
