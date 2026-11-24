import type { Metadata } from "next";

import { approvedCanonicalOrigin, loadSeoConfig, type SeoConfig, type SeoEnv } from "./config.js";
import type { SeoAdaptedContent } from "./content.js";
import { mapLocaleContext, type LocaleContext } from "./locale.js";
import { hreflangTag, omitRetiredHreflang } from "./locale-switch.js";
import type { NormalizedSeoOptions } from "./options.js";
import { resolveCanonical, resolvePagePolicy, type PagePolicy } from "./policy.js";
import type { ProductOpenGraphPrice } from "./product-open-graph.js";
import type { LanguageAlternate } from "./types.js";
import { resolveUrl, type UrlResolution } from "./url.js";

export type PolicyContext = {
  url: UrlResolution;
  policy: PagePolicy;
};

/** Approved public origin for metadata and JSON-LD. Null on localhost and other blocked hosts. */
export function originFor(env: SeoEnv | undefined, options: NormalizedSeoOptions): string | null {
  return approvedCanonicalOrigin(loadSeoConfig(env ?? {}, options), options);
}

export function policyFor(
  input: {
    kind: string;
    locale: string;
    path: string;
    searchParams?: URLSearchParams | Record<string, string | string[] | undefined>;
    facetAttributeCodes?: readonly string[];
    published?: boolean;
    env?: SeoEnv;
  },
  options: NormalizedSeoOptions,
): PolicyContext {
  const url = resolveUrl(
    {
      locale: input.locale,
      path: input.path,
      searchParams: input.searchParams,
      pageKind: input.kind,
      facetAttributeCodes: input.facetAttributeCodes,
    },
    options,
  );
  const policy = resolvePagePolicy(
    {
      kind: input.kind,
      indexingEnabled: loadSeoConfig(input.env ?? {}, options).indexingEnabled,
      published: input.published,
      url,
    },
    options,
  );
  return { url, policy };
}

/**
 * Editorial robots can only remove index or follow.
 * They cannot turn indexing back on ahead of the deployment gate.
 */
export function tightenWithEditorial(
  policy: PagePolicy,
  editorialRobots: string | undefined,
): PagePolicy {
  if (!policy.robots || !editorialRobots) return policy;
  const text = editorialRobots.toLowerCase();
  const index = text.includes("noindex") ? false : policy.robots.index;
  const follow = text.includes("nofollow") ? false : policy.robots.follow;
  return {
    ...policy,
    robots: {
      index,
      follow,
      ...(index && policy.robots.maxImagePreview
        ? { maxImagePreview: policy.robots.maxImagePreview }
        : {}),
    },
  };
}

export function buildPageMetadata(
  input: {
    content: SeoAdaptedContent;
    policy: PagePolicy;
    origin: string;
    url: UrlResolution;
    /** Other published language versions. A missing counterpart is left out. */
    alternates?: LanguageAlternate[];
    siteName?: string;
    /**
     * Set only for the product page. `null` still marks the page as a product
     * so `og:type` is not `website`. Price tags are rendered separately.
     */
    productOffer?: ProductOpenGraphPrice | null;
  },
  options: NormalizedSeoOptions,
): Metadata {
  const title = input.content.title;
  const description = input.content.description;
  const keywords = input.content.keywords?.trim();
  const canonical = resolveCanonical({
    origin: input.origin,
    url: input.url,
    policy: input.policy,
    options,
  });
  const robots = input.policy.robots;
  const shareUrl = canonical.mode === "omit" ? undefined : canonical.url;
  const page = input.url.paginationPage;
  const languages =
    shareUrl && (page == null || page <= 1)
      ? hreflangLanguages(shareUrl, input.content.locale, input.alternates ?? [], options)
      : undefined;
  const image = input.content.ogImage;
  const siteName = input.siteName ?? options.brandName[input.content.locale];

  return {
    title: { absolute: title },
    ...(description ? { description } : {}),
    ...(keywords ? { keywords } : {}),
    ...(robots
      ? {
          robots: {
            index: robots.index,
            follow: robots.follow,
            ...(robots.maxImagePreview
              ? { maxImagePreview: robots.maxImagePreview }
              : {}),
          },
        }
      : {}),
    ...(shareUrl
      ? {
          alternates: {
            canonical: shareUrl,
            ...(languages ? { languages } : {}),
          },
        }
      : {}),
    openGraph: {
      ...(input.productOffer === undefined ? { type: "website" as const } : {}),
      ...(siteName ? { siteName } : {}),
      title,
      ...(description ? { description } : {}),
      ...(shareUrl ? { url: shareUrl } : {}),
      ...(image ? { images: [sharingImageTag(image)] } : {}),
      ...(input.content.ogLocale ? { locale: input.content.ogLocale } : {}),
    },
    ...(image
      ? {
          twitter: {
            card: "summary_large_image" as const,
            title,
            ...(description ? { description } : {}),
            images: [sharingImageTag(image)],
          },
        }
      : {}),
  };
}

export function withPagedTitle(
  content: SeoAdaptedContent,
  title: string,
  brandName: string,
): SeoAdaptedContent {
  return {
    ...content,
    title,
    titleContainsBrand: brandName.length > 0 && title.includes(brandName),
  };
}

export function copyContent(
  context: LocaleContext,
  input: {
    kind: SeoAdaptedContent["kind"];
    entityKey: string;
    publicPath: string;
    title: string;
    description?: string;
    published?: boolean;
  },
): SeoAdaptedContent {
  const titleContainsBrand =
    context.brandName.length > 0 && input.title.includes(context.brandName);
  return {
    kind: input.kind,
    locale: context.locale,
    storeView: context.storeView,
    htmlLang: context.htmlLang,
    direction: context.direction,
    hreflang: context.hreflang,
    ...(context.ogLocale ? { ogLocale: context.ogLocale } : {}),
    entityKey: input.entityKey,
    publicPath: input.publicPath,
    title: input.title,
    titleFrom: "name",
    brandAppended: false,
    titleContainsBrand,
    ...(input.description
      ? { description: input.description, descriptionFrom: "meta" as const }
      : { descriptionFrom: "none" as const }),
    ogTitle: input.title,
    ...(input.description ? { ogDescription: input.description } : {}),
    published: input.published ?? true,
    warnings: [],
  };
}

function sharingImageTag(image: NonNullable<SeoAdaptedContent["ogImage"]>): {
  url: string;
  alt: string;
  type?: string;
  width?: number;
  height?: number;
} {
  return {
    url: image.url,
    alt: image.alt,
    ...(image.mimeType ? { type: image.mimeType } : {}),
    ...(image.width && image.height ? { width: image.width, height: image.height } : {}),
  };
}

/**
 * Emit hreflang only for a public locale, and only when another public
 * counterpart exists. Page 2 and later omit the language map.
 * The captured helper required `locale === "ar"` and also
 * `alternate.hreflang === "ar" && alternate.hreflang !== locale`, which cannot
 * match. This follows the comments on alternates and retired tags instead.
 */
function hreflangLanguages(
  selfUrl: string,
  locale: string,
  alternates: LanguageAlternate[],
  options: NormalizedSeoOptions,
): Record<string, string> | undefined {
  if (!options.publicLocales.has(locale)) return undefined;
  const others = alternates.filter(
    (alternate) =>
      options.publicLocales.has(alternate.hreflang) &&
      alternate.hreflang !== locale &&
      alternate.url !== selfUrl,
  );
  if (others.length === 0) return undefined;
  return omitRetiredHreflang(
    {
      [hreflangTag(locale, options)]: selfUrl,
      ...Object.fromEntries(
        others.map((alternate) => [hreflangTag(alternate.hreflang, options), alternate.url]),
      ),
    },
    options,
  );
}

export type { SeoConfig };
