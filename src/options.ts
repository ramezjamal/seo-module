import type { RobotsDirective } from "./types.js";

/**
 * `public` matches an indexable catalog page: page 1 is sitemap-eligible,
 * later pages keep a self canonical and leave the sitemap.
 * `public-when-published` uses that rule only when `published` is true.
 * Otherwise it is noindex, follow, canonical omitted, HTTP 200.
 * `fixed` is returned as written. Statuses other than 200 skip query and
 * deployment modifiers, matching the captured policy function.
 */
export type PagePolicyTemplate =
  | { kind: "public" }
  | { kind: "public-when-published" }
  | {
      kind: "fixed";
      robots: RobotsDirective | null;
      canonical: "self" | "omit";
      sitemapEligible: boolean;
      httpStatus: 200 | 404 | 503;
    };

export type SeoOptions = {
  locales: readonly string[];
  defaultLocale: string;
  /** Locales that may appear in the sitemap and as hreflang emitters. */
  publicLocales: readonly string[];
  localePresentation: Readonly<
    Record<string, { htmlLang: string; direction: "ltr" | "rtl" }>
  >;
  /** Regional hreflang tag for each route locale, such as `en` → `en-KW`. */
  hreflang: Readonly<Record<string, string>>;
  /**
   * Tags removed after the hreflang map is built.
   * Empty means no tag is retired.
   */
  retiredHreflang?: readonly string[];
  brandName: Readonly<Record<string, string>>;
  storeViewByLocale?: Readonly<Record<string, string>>;
  paths?: {
    /** One leading segment stripped from storefront paths, such as `c`, `p`, `b`. */
    legacyPrefixes?: readonly string[];
    /**
     * First path segments that may change locale by prefix swap.
     * Home (`/`) is always safe. Unlisted paths switch to that locale's home.
     */
    prefixSwapSafe?: readonly string[];
  };
  query?: {
    tracking?: readonly string[];
    facets?: readonly string[];
    preview?: readonly string[];
    display?: readonly string[];
    variant?: readonly string[];
    /** Page kinds where `variant` names are variants instead of facets. */
    variantPageKinds?: readonly string[];
    searchIdentity?: readonly string[];
    searchPageKinds?: readonly string[];
    listingControl?: readonly string[];
  };
  policies: Readonly<Record<string, PagePolicyTemplate>>;
  origins?: {
    blockedHosts?: readonly string[];
    /** Configured origins that may preview launch robots and sitemaps while indexing is off. */
    stagingOrigins?: readonly string[];
  };
  /** Child sitemap group order. Entries use these group names. */
  sitemapGroups?: readonly string[];
  /** Default media origins when `SEO_MEDIA_ORIGINS` is unset. */
  mediaOrigins?: readonly string[];
  /**
   * Cache tags that refresh the sitemap, besides the exact `seo:sitemap` tag.
   * Each entry is a prefix. A trailing `$` is not special.
   */
  sitemapTagPrefixes?: readonly string[];
  /**
   * `production` requires the indexing flag, `DEPLOYMENT_ENV=production`, and an approved origin.
   * `requested` still requires the flag and an approved origin, and skips the deployment check.
   */
  indexingGate?: "production" | "requested";
  /** Env var name for each locale's `ll_CC` Open Graph locale. */
  ogLocaleEnv?: Readonly<Record<string, string>>;
};

export type NormalizedSeoOptions = {
  locales: ReadonlySet<string>;
  localeList: readonly string[];
  defaultLocale: string;
  publicLocales: ReadonlySet<string>;
  publicLocaleList: readonly string[];
  localePresentation: SeoOptions["localePresentation"];
  hreflang: Readonly<Record<string, string>>;
  retiredHreflang: ReadonlySet<string>;
  retiredPathLocales: ReadonlySet<string>;
  brandName: Readonly<Record<string, string>>;
  storeViewByLocale: Readonly<Record<string, string>>;
  legacyPrefixes: ReadonlySet<string>;
  prefixSwapSafe: ReadonlySet<string>;
  tracking: ReadonlySet<string>;
  facets: ReadonlySet<string>;
  preview: ReadonlySet<string>;
  display: ReadonlySet<string>;
  variant: ReadonlySet<string>;
  variantPageKinds: ReadonlySet<string>;
  searchIdentity: ReadonlySet<string>;
  searchPageKinds: ReadonlySet<string>;
  listingControl: ReadonlySet<string>;
  policies: SeoOptions["policies"];
  blockedHosts: ReadonlySet<string>;
  stagingOrigins: ReadonlySet<string>;
  sitemapGroups: readonly string[];
  mediaOrigins: readonly string[];
  sitemapTagPrefixes: readonly string[];
  indexingGate: "production" | "requested";
  ogLocaleEnv: Readonly<Record<string, string>>;
};

const DEFAULT_BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "example.com",
  "www.example.com",
];

export function normalizeSeoOptions(options: SeoOptions): NormalizedSeoOptions {
  if (options.locales.length === 0) {
    throw new Error("SEO options require at least one locale.");
  }
  if (!options.locales.includes(options.defaultLocale)) {
    throw new Error("SEO defaultLocale must be one of locales.");
  }
  for (const locale of options.publicLocales) {
    if (!options.locales.includes(locale)) {
      throw new Error(`Public locale is not in locales: ${locale}`);
    }
  }
  for (const locale of options.locales) {
    if (!options.localePresentation[locale]) {
      throw new Error(`Missing locale presentation for ${locale}.`);
    }
    if (!options.hreflang[locale]) {
      throw new Error(`Missing hreflang tag for ${locale}.`);
    }
    if (!options.brandName[locale]) {
      throw new Error(`Missing brand name for ${locale}.`);
    }
  }

  const storeViewByLocale: Record<string, string> = {};
  for (const locale of options.locales) {
    storeViewByLocale[locale] = options.storeViewByLocale?.[locale] ?? locale;
  }

  const ogLocaleEnv: Record<string, string> = {};
  for (const locale of options.locales) {
    ogLocaleEnv[locale] =
      options.ogLocaleEnv?.[locale] ??
      `SEO_OG_LOCALE_${locale.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  }

  return {
    locales: new Set(options.locales),
    localeList: options.locales,
    defaultLocale: options.defaultLocale,
    publicLocales: new Set(options.publicLocales),
    publicLocaleList: options.publicLocales,
    localePresentation: options.localePresentation,
    hreflang: options.hreflang,
    retiredHreflang: new Set(options.retiredHreflang ?? []),
    retiredPathLocales: new Set(
      options.locales.filter((locale) => !options.publicLocales.includes(locale)),
    ),
    brandName: options.brandName,
    storeViewByLocale,
    legacyPrefixes: new Set(options.paths?.legacyPrefixes ?? []),
    prefixSwapSafe: new Set(options.paths?.prefixSwapSafe ?? []),
    tracking: new Set(options.query?.tracking ?? []),
    facets: new Set(options.query?.facets ?? []),
    preview: new Set(options.query?.preview ?? []),
    display: new Set(options.query?.display ?? []),
    variant: new Set(options.query?.variant ?? []),
    variantPageKinds: new Set(options.query?.variantPageKinds ?? []),
    searchIdentity: new Set(options.query?.searchIdentity ?? []),
    searchPageKinds: new Set(options.query?.searchPageKinds ?? []),
    listingControl: new Set(options.query?.listingControl ?? []),
    policies: options.policies,
    blockedHosts: new Set([
      ...DEFAULT_BLOCKED_HOSTS,
      ...(options.origins?.blockedHosts ?? []),
    ]),
    stagingOrigins: new Set(options.origins?.stagingOrigins ?? []),
    sitemapGroups: options.sitemapGroups ?? [
      "products",
      "categories",
      "brands",
      "content",
    ],
    mediaOrigins: options.mediaOrigins ?? [],
    sitemapTagPrefixes: options.sitemapTagPrefixes ?? [],
    indexingGate: options.indexingGate ?? "production",
    ogLocaleEnv,
  };
}
