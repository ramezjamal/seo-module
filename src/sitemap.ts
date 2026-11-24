import { isApprovedProductionOrigin, sitemapFileLimits } from "./config.js";
import type { NormalizedSeoOptions } from "./options.js";
import { resolvePagePolicy } from "./policy.js";
import { absoluteUrl, resolveUrl } from "./url.js";

export type SitemapEntry = {
  loc: string;
  locale: string;
  group: string;
  /** W3C datetime. Omitted when the source has no modification time. */
  lastmod?: string;
};

const URLSET_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

/**
 * A public, indexable, self-canonical URL on an approved origin.
 * Query variants, private routes, and unpublished pages are omitted.
 * `lastmod` is copied only when the caller supplies a real modification time.
 */
export function selectSitemapEntry(
  input: {
    origin: string;
    locale: string;
    path: string;
    kind: string;
    group: string;
    published?: boolean;
    searchParams?: Record<string, string>;
    lastmod?: string | number | null;
  },
  options: NormalizedSeoOptions,
): SitemapEntry | null {
  if (!options.publicLocales.has(input.locale)) return null;
  if (!isApprovedProductionOrigin(input.origin, options)) return null;

  const url = resolveUrl(
    {
      locale: input.locale,
      path: input.path,
      pageKind: input.kind,
      searchParams: input.searchParams,
    },
    options,
  );
  const policy = resolvePagePolicy(
    {
      kind: input.kind,
      indexingEnabled: true,
      published: input.published,
      url,
    },
    options,
  );
  if (!policy.sitemapEligible || policy.canonical !== "self") return null;
  if (policy.httpStatus !== 200) return null;
  if (
    url.hasFacet ||
    url.hasSort ||
    url.hasListingControl ||
    url.hasPreview ||
    url.hasUnresolved ||
    url.consolidatingVariant ||
    (url.paginationPage != null && url.paginationPage > 1)
  ) {
    return null;
  }

  const loc = absoluteUrl(input.origin, url.pathname);
  if (!loc.startsWith(`${input.origin}/`) && loc !== input.origin) return null;
  const lastmod = sitemapLastmod(input.lastmod);
  return {
    loc,
    locale: input.locale,
    group: input.group,
    ...(lastmod ? { lastmod } : {}),
  };
}

/**
 * Sitemap `lastmod` as `YYYY-MM-DDThh:mm:ss+00:00`.
 * Accepts an ISO datetime, a `YYYY-MM-DD hh:mm:ss` UTC value, or unix seconds.
 * Unparseable values are omitted. A generation clock is not a modification time.
 */
export function sitemapLastmod(value: string | number | null | undefined): string | undefined {
  if (value == null || value === "") return undefined;
  const ms = lastmodMilliseconds(value);
  if (ms == null) return undefined;
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 19)}+00:00`;
}

function lastmodMilliseconds(value: string | number): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return lastmodMilliseconds(Number(trimmed));
  }
  let normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(normalized)) {
    normalized += "Z";
  }
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : ms;
}

export function dedupeSitemapEntries(entries: readonly SitemapEntry[]): SitemapEntry[] {
  const seen = new Set<string>();
  const unique: SitemapEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.loc)) continue;
    seen.add(entry.loc);
    unique.push(entry);
  }
  return unique;
}

export type SitemapFile = {
  name: string;
  xml: string;
  lastmod?: string;
};

export type SitemapPublication =
  | { kind: "urlset"; xml: string }
  | { kind: "index"; xml: string; files: SitemapFile[] };

/**
 * Always a sitemap index. Each child is one entity group and locale, split
 * again only when that file would pass 50,000 URLs or 50 MB uncompressed.
 */
export function publishSitemap(
  origin: string,
  entries: readonly SitemapEntry[],
  options: NormalizedSeoOptions,
  limits: { maxUrls: number; maxUncompressedBytes: number } = sitemapFileLimits,
  indexPath = "/sitemap/",
): SitemapPublication {
  const unique = dedupeSitemapEntries(entries.filter((entry) => isPublicSitemapEntry(entry, options)));
  if (unique.length === 0) {
    throw new Error("Refusing to publish an empty sitemap.");
  }

  const files: SitemapFile[] = [];
  for (const group of groupEntries(unique, options)) {
    const chunks = splitEntries(group.entries, limits, options);
    chunks.forEach((chunk, index) => {
      const suffix = chunks.length > 1 ? `-${index + 1}` : "";
      const lastmod = newestLastmod(chunk);
      files.push({
        name: `${group.key}${suffix}.xml`,
        xml: renderUrlSet(chunk, options),
        ...(lastmod ? { lastmod } : {}),
      });
    });
  }
  return {
    kind: "index",
    xml: renderSitemapIndex(
      files.map((file) => ({
        loc: `${origin}${indexPath}${file.name}`,
        lastmod: file.lastmod,
      })),
    ),
    files,
  };
}

export function renderUrlSet(
  entries: readonly SitemapEntry[],
  options: NormalizedSeoOptions,
): string {
  const body = entries
    .filter((entry) => isPublicSitemapEntry(entry, options))
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      return `  <url><loc>${escapeXml(entry.loc)}</loc>${lastmod}</url>`;
    })
    .join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="${URLSET_NS}">`,
    body,
    `</urlset>`,
    ``,
  ].join("\n");
}

export function renderSitemapIndex(
  entries: readonly { loc: string; lastmod?: string }[],
): string {
  const body = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      return `  <sitemap><loc>${escapeXml(entry.loc)}</loc>${lastmod}</sitemap>`;
    })
    .join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="${URLSET_NS}">`,
    body,
    `</sitemapindex>`,
    ``,
  ].join("\n");
}

function isPublicSitemapEntry(entry: SitemapEntry, options: NormalizedSeoOptions): boolean {
  return options.publicLocales.has(entry.locale) && !isRetiredSitemapLoc(entry.loc, options);
}

/** A path whose first segment is a configured locale that is not public. */
function isRetiredSitemapLoc(loc: string, options: NormalizedSeoOptions): boolean {
  let pathname: string;
  try {
    pathname = new URL(loc).pathname;
  } catch {
    pathname = loc;
  }
  for (const locale of options.retiredPathLocales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) return true;
  }
  return false;
}

function newestLastmod(entries: readonly SitemapEntry[]): string | undefined {
  let newest: string | undefined;
  for (const entry of entries) {
    if (!entry.lastmod) continue;
    if (!newest || entry.lastmod > newest) newest = entry.lastmod;
  }
  return newest;
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function groupEntries(
  entries: readonly SitemapEntry[],
  options: NormalizedSeoOptions,
): Array<{ key: string; entries: SitemapEntry[] }> {
  const groups: Array<{ key: string; entries: SitemapEntry[] }> = [];
  for (const locale of options.publicLocaleList) {
    for (const group of options.sitemapGroups) {
      const matching = entries.filter(
        (entry) => entry.locale === locale && entry.group === group,
      );
      if (matching.length === 0) continue;
      groups.push({ key: `${group}-${locale}`, entries: matching });
    }
  }
  return groups;
}

function splitEntries(
  entries: readonly SitemapEntry[],
  limits: { maxUrls: number; maxUncompressedBytes: number },
  options: NormalizedSeoOptions,
): SitemapEntry[][] {
  const chunks: SitemapEntry[][] = [];
  let current: SitemapEntry[] = [];
  for (const entry of entries) {
    const next = [...current, entry];
    const tooMany = next.length > limits.maxUrls;
    const tooLarge = Buffer.byteLength(renderUrlSet(next, options), "utf8") > limits.maxUncompressedBytes;
    if (current.length > 0 && (tooMany || tooLarge)) {
      chunks.push(current);
      current = [entry];
      continue;
    }
    current = next;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
