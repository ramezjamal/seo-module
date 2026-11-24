import { loadSeoConfig, type SeoEnv } from "./config.js";
import type { NormalizedSeoOptions } from "./options.js";
import type { LanguageAlternate } from "./types.js";
import { absoluteUrl } from "./url.js";

export type LocaleContext = {
  locale: string;
  storeView: string;
  htmlLang: string;
  direction: "ltr" | "rtl";
  /**
   * Route language. The emitted `hreflang` is the configured regional tag.
   * This field is not an Open Graph locale.
   */
  hreflang: string;
  /** Set only when the Open Graph env var is an explicit `language_TERRITORY` value. */
  ogLocale?: string;
  brandName: string;
  mediaOrigins: readonly string[];
  brandSharingImage: {
    url: string;
    width?: number;
    height?: number;
  } | null;
};

export function mapLocaleContext(
  locale: string,
  options: NormalizedSeoOptions,
  env: SeoEnv = {},
): LocaleContext {
  const config = loadSeoConfig(env, options);
  const presentation = options.localePresentation[locale];
  if (!presentation) {
    throw new Error(`Missing locale presentation for ${locale}.`);
  }
  const ogLocale = config.ogLocale[locale];
  const brandName = options.brandName[locale];
  if (!brandName) throw new Error(`Missing brand name for ${locale}.`);
  return {
    locale,
    storeView: config.storeViewByLocale[locale] ?? locale,
    htmlLang: presentation.htmlLang,
    direction: presentation.direction,
    hreflang: presentation.htmlLang,
    ...(ogLocale ? { ogLocale } : {}),
    brandName,
    mediaOrigins: config.mediaOrigins,
    brandSharingImage: config.brandSharingImage,
  };
}

/**
 * Include a language only when that locale has its own public path.
 * A missing path is omitted. It is not replaced with the other language's slug.
 */
export function mapLanguageAlternates(
  origin: string,
  versions: ReadonlyArray<{ locale: string; publicPath: string | null }>,
): LanguageAlternate[] {
  const alternates: LanguageAlternate[] = [];
  for (const version of versions) {
    if (!version.publicPath) continue;
    if (
      version.publicPath !== `/${version.locale}` &&
      !version.publicPath.startsWith(`/${version.locale}/`)
    ) {
      continue;
    }
    alternates.push({
      hreflang: version.locale,
      url: absoluteUrl(origin, version.publicPath),
    });
  }
  return alternates;
}

export function publicCatalogPath(locale: string, slugPath: string): string {
  const trimmed = slugPath.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${locale}/${trimmed}` : `/${locale}`;
}
