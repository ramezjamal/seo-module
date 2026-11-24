import type { NormalizedSeoOptions } from "./options.js";
import type { ClassifiedParam, LanguageAlternate, QueryParamClass } from "./types.js";

export type ClassifyContext = {
  pageKind?: string;
  /** Facet attribute codes supplied by the caller. Not a hardcoded catalog. */
  facetAttributeCodes?: readonly string[];
};

export class UrlResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlResolveError";
  }
}

export type StorefrontPath = {
  locale: string;
  /** Locale-prefixed path, no trailing slash, no `.html`. */
  pathname: string;
};

export type UrlResolution = {
  pathname: string;
  params: ClassifiedParam[];
  unresolvedParams: string[];
  strippedTracking: string[];
  /** Null when `page` is absent or not a positive integer. Invalid values are not coerced to 1. */
  paginationPage: number | null;
  /** `page` is present and is not a positive integer (`0`, negatives, fractions, or other text). */
  invalidPage: boolean;
  hasFacet: boolean;
  hasSort: boolean;
  hasListingControl: boolean;
  hasDisplay: boolean;
  hasVariant: boolean;
  hasPreview: boolean;
  hasUnresolved: boolean;
  /** Tracking params present and no other non-pagination params. */
  trackingOnlyVariant: boolean;
  /**
   * Tracking, display, or variant params are present, and no facet, sort,
   * preview, unresolved, or search param blocks consolidation.
   */
  consolidatingVariant: boolean;
};

export function classifyQueryParam(
  name: string,
  value: string,
  options: NormalizedSeoOptions,
  context: ClassifyContext = {},
): QueryParamClass {
  if (name.startsWith("utm_") || options.tracking.has(name)) return "tracking";
  if (name === "page") {
    return validPageValue(value) ? "pagination" : "unresolved";
  }
  if (name === "sort") return "sort";
  if (options.display.has(name)) return "display";
  if (
    options.variant.has(name) &&
    context.pageKind != null &&
    options.variantPageKinds.has(context.pageKind)
  ) {
    return "variant";
  }
  if (options.listingControl.has(name)) return "listing-control";
  if (options.facets.has(name)) return "facet";
  if (context.facetAttributeCodes?.includes(name)) return "facet";
  if (options.preview.has(name)) return "preview";
  if (
    options.searchIdentity.has(name) &&
    context.pageKind != null &&
    options.searchPageKinds.has(context.pageKind)
  ) {
    return "search-identity";
  }
  return "unresolved";
}

/**
 * Build `/{locale}/{path}`.
 * Strips a trailing slash, rejects `.html`, and rewrites one leading legacy prefix.
 * Does not lowercase.
 */
export function buildStorefrontPath(
  locale: string,
  path: string,
  options: NormalizedSeoOptions,
): StorefrontPath {
  if (!options.locales.has(locale)) {
    throw new UrlResolveError(`Unsupported locale: ${locale}`);
  }

  const withoutHash = path.split("#")[0] ?? "";
  const withoutQuery = withoutHash.split("?")[0] ?? "";
  let normalized = withoutQuery.trim();
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  const segments = normalized
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(decodeSegmentOnce);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new UrlResolveError("Path segments must not contain . or ..");
  }
  if (segments.some((segment) => segment.toLowerCase().endsWith(".html"))) {
    throw new UrlResolveError("Storefront URLs do not use a .html suffix");
  }

  let rest = segments;
  if (rest[0] && options.locales.has(rest[0])) {
    rest = rest.slice(1);
  }
  rest = stripLegacyCatalogPrefix(rest, options.legacyPrefixes);

  const encoded = rest.map((segment) => encodeURIComponent(segment));
  const pathname = encoded.length ? `/${locale}/${encoded.join("/")}` : `/${locale}`;
  return { locale, pathname };
}

export function resolveUrl(
  input: {
    locale: string;
    path: string;
    searchParams?:
      | URLSearchParams
      | Record<string, string | string[] | undefined>;
    pageKind?: string;
    facetAttributeCodes?: readonly string[];
  },
  options: NormalizedSeoOptions,
): UrlResolution {
  const { pathname } = buildStorefrontPath(input.locale, input.path, options);
  const params = readParams(input.searchParams).map((param) => ({
    ...param,
    class: classifyQueryParam(param.name, param.value, options, {
      pageKind: input.pageKind,
      facetAttributeCodes: input.facetAttributeCodes,
    }),
  }));

  const unresolvedParams = params
    .filter((param) => param.class === "unresolved")
    .map((param) => param.name);
  const strippedTracking = params
    .filter((param) => param.class === "tracking")
    .map((param) => param.name);

  const pageParam = params.find((param) => param.class === "pagination");
  const paginationPage = pageParam ? Number(pageParam.value) : null;

  const hasFacet = params.some((param) => param.class === "facet");
  const hasSort = params.some((param) => param.class === "sort");
  const hasListingControl = params.some((param) => param.class === "listing-control");
  const hasDisplay = params.some((param) => param.class === "display");
  const hasVariant = params.some((param) => param.class === "variant");
  const hasPreview = params.some((param) => param.class === "preview");
  const hasUnresolved = unresolvedParams.length > 0;
  const hasTracking = strippedTracking.length > 0;
  const hasSearchIdentity = params.some((param) => param.class === "search-identity");
  const blocksConsolidation =
    hasFacet ||
    hasSort ||
    hasListingControl ||
    hasPreview ||
    hasUnresolved ||
    hasSearchIdentity;
  const trackingOnlyVariant =
    hasTracking && !hasDisplay && !hasVariant && !blocksConsolidation;
  const consolidatingVariant =
    (hasTracking || hasDisplay || hasVariant) && !blocksConsolidation;

  return {
    pathname,
    params,
    unresolvedParams,
    strippedTracking,
    paginationPage,
    invalidPage: hasInvalidPageQuery(input.searchParams),
    hasFacet,
    hasSort,
    hasListingControl,
    hasDisplay,
    hasVariant,
    hasPreview,
    hasUnresolved,
    trackingOnlyVariant,
    consolidatingVariant,
  };
}

/**
 * Absolute URL for a storefront path. `origin` must already be the configured
 * public origin. Query keys are appended in input order.
 */
export function absoluteUrl(
  origin: string,
  pathname: string,
  params: ClassifiedParam[] = [],
): string {
  const base = origin.replace(/\/$/, "");
  const kept = params.filter((param) => includeOnIdentityUrl(param));
  const query = new URLSearchParams();
  for (const param of kept) query.append(param.name, param.value);
  const qs = query.toString();
  return qs ? `${base}${pathname}?${qs}` : `${base}${pathname}`;
}

/** Params that stay on a self/consolidated identity URL. Facets, sort, preview, display, variant, and tracking do not. */
export function includeOnIdentityUrl(param: ClassifiedParam): boolean {
  if (param.class === "tracking") return false;
  if (param.class === "facet") return false;
  if (param.class === "sort") return false;
  if (param.class === "listing-control") return false;
  if (param.class === "display") return false;
  if (param.class === "variant") return false;
  if (param.class === "preview") return false;
  if (param.class === "search-identity") return false;
  if (param.class === "pagination") return Number(param.value) > 1;
  return param.class === "unresolved";
}

/**
 * Hreflang for the same entity. Missing counterparts are omitted.
 * Does not copy the current slug into the other locale or substitute the homepage.
 * Does not add `x-default`.
 *
 * The function body after this comment was not in the captured file. This
 * implementation follows that comment and `mapLanguageAlternates`.
 */
export function resolveAlternates(
  input: {
    origin: string;
    current: { locale: string; path: string };
    counterparts: Partial<Record<string, string | null | undefined>>;
  },
  options: NormalizedSeoOptions,
): LanguageAlternate[] {
  const alternates: LanguageAlternate[] = [];
  const currentPath = localePrefixedPath(input.current.locale, input.current.path);
  if (currentPath) {
    alternates.push({
      hreflang: input.current.locale,
      url: absoluteUrl(input.origin, currentPath),
    });
  }
  for (const locale of options.localeList) {
    if (locale === input.current.locale) continue;
    const counterpart = input.counterparts[locale];
    if (!counterpart) continue;
    const path = localePrefixedPath(locale, counterpart);
    if (!path) continue;
    alternates.push({
      hreflang: locale,
      url: absoluteUrl(input.origin, path),
    });
  }
  return alternates;
}

export function hasInvalidPageQuery(
  searchParams:
    | URLSearchParams
    | Record<string, string | string[] | undefined>
    | undefined,
): boolean {
  return pageQueryValues(searchParams).some((value) => !validPageValue(value));
}

/** Captured body: a positive integer without leading zeros. */
export function validPageValue(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

function localePrefixedPath(locale: string, path: string): string | null {
  if (path !== `/${locale}` && !path.startsWith(`/${locale}/`)) return null;
  return path;
}

function stripLegacyCatalogPrefix(
  segments: string[],
  legacy: ReadonlySet<string>,
): string[] {
  const head = segments[0];
  if (head && legacy.has(head)) return segments.slice(1);
  return segments;
}

/**
 * Decode a path segment once. The original helper was not captured.
 * A segment without `%` is unchanged. An invalid escape is left as written.
 */
function decodeSegmentOnce(segment: string): string {
  if (!segment.includes("%")) return segment;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function pageQueryValues(
  searchParams:
    | URLSearchParams
    | Record<string, string | string[] | undefined>
    | undefined,
): string[] {
  if (!searchParams) return [];
  if (searchParams instanceof URLSearchParams) return searchParams.getAll("page");
  const raw = searchParams.page;
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw;
  return [];
}

function readParams(
  searchParams:
    | URLSearchParams
    | Record<string, string | string[] | undefined>
    | undefined,
): Array<{ name: string; value: string }> {
  if (!searchParams) return [];
  if (searchParams instanceof URLSearchParams) {
    const rows: Array<{ name: string; value: string }> = [];
    searchParams.forEach((value, name) => {
      rows.push({ name, value });
    });
    return rows;
  }
  const rows: Array<{ name: string; value: string }> = [];
  for (const [name, raw] of Object.entries(searchParams)) {
    if (typeof raw === "string") rows.push({ name, value: raw });
    else if (Array.isArray(raw)) {
      for (const value of raw) rows.push({ name, value });
    }
  }
  return rows;
}
