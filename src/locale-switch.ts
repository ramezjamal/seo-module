import type { NormalizedSeoOptions } from "./options.js";

export function hreflangTag(locale: string, options: NormalizedSeoOptions): string {
  const tag = options.hreflang[locale];
  if (!tag) throw new Error(`Missing hreflang tag for ${locale}.`);
  return tag;
}

/**
 * Drop configured retired tags, and URLs whose path uses a locale that is not public.
 */
export function omitRetiredHreflang(
  languages: Record<string, string> | undefined,
  options: NormalizedSeoOptions,
): Record<string, string> | undefined {
  if (!languages) return undefined;
  const next: Record<string, string> = {};
  for (const [tag, url] of Object.entries(languages)) {
    if (options.retiredHreflang.has(tag)) continue;
    if (isRetiredPublicHref(url, options)) continue;
    next[tag] = url;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function isRetiredPublicHref(url: string, options: NormalizedSeoOptions): boolean {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }
  for (const locale of options.retiredPathLocales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) return true;
    if (pathname.endsWith(`/${locale}`) || pathname.includes(`/${locale}/`)) return true;
  }
  return false;
}

export type LocaleSwitchInput = {
  nextLocale: string;
  /** Absolute or path-only href from `link[rel=alternate][hreflang]`. */
  alternateHref?: string | null;
  /** Current pathname without query or hash. */
  pathname: string;
};

/**
 * Resolve the next URL for the language switcher.
 * Prefer the hreflang alternate for the same entity. Otherwise prefix-swap only
 * safe routes. A path without an alternate goes to that locale's home so a
 * missing translation is not invented.
 */
export function resolveLocaleSwitchPath(
  input: LocaleSwitchInput,
  options: NormalizedSeoOptions,
): string {
  const alternate = cleanAlternate(input.alternateHref);
  if (alternate) return alternate;

  const stripped = stripLocalePrefix(input.pathname, options);
  if (isPrefixSwapSafe(stripped, options)) {
    return withLocalePrefix(stripped, input.nextLocale);
  }
  return `/${input.nextLocale}`;
}

export function isPrefixSwapSafe(
  pathWithoutLocale: string,
  options: NormalizedSeoOptions,
): boolean {
  const normalized = normalizePath(pathWithoutLocale);
  if (normalized === "/") return true;
  const first = normalized.split("/").filter(Boolean)[0] ?? "";
  return options.prefixSwapSafe.has(first);
}

function cleanAlternate(href: string | null | undefined): string | null {
  const text = href?.trim();
  if (!text) return null;
  if (text.startsWith("/")) return text.split(/[?#]/)[0] || "/";
  try {
    const url = new URL(text);
    return `${url.pathname}`.replace(/\/$/, "") || "/";
  } catch {
    return null;
  }
}

function stripLocalePrefix(pathname: string, options: NormalizedSeoOptions): string {
  const normalized = normalizePath(pathname);
  const match = normalized.match(localePrefixPattern(options.localeList));
  if (!match) return normalized;
  return match[2] && match[2].length > 0 ? match[2] : "/";
}

function withLocalePrefix(pathWithoutLocale: string, locale: string): string {
  const normalized = normalizePath(pathWithoutLocale);
  if (normalized === "/") return `/${locale}`;
  return `/${locale}${normalized}`;
}

function normalizePath(path: string): string {
  const withoutQuery = path.split(/[?#]/)[0] ?? "/";
  let value = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  if (value.length > 1 && value.endsWith("/")) value = value.slice(0, -1);
  return value || "/";
}

function localePrefixPattern(locales: readonly string[]): RegExp {
  const body = locales.map(escapeRegex).join("|");
  return new RegExp(`^\\/(${body})(\\/.*)?$`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
