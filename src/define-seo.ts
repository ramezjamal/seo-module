import {
  publicCacheKey,
  refreshesSitemap,
  storeViewForPublicCache,
  takeRevalidationSlot,
  type PublicCacheIdentity,
} from "./cache.js";
import {
  assertReleaseConfig,
  isApprovedProductionOrigin,
  launchPreviewRequestAllowed,
  launchSeoPreviewAllowed,
  loadSeoConfig,
  shouldPublishSitemap,
  validateReleaseConfig,
  type SeoEnv,
} from "./config.js";
import {
  composeDescription,
  composeTitle,
  editorialRobots,
  ignoredCanonical,
  plainText,
  presentText,
  qualityWarnings,
} from "./content.js";
import { resolveSharingImage, type SharingImageCandidate } from "./images.js";
import { mapLanguageAlternates, mapLocaleContext, publicCatalogPath } from "./locale.js";
import {
  hreflangTag,
  isPrefixSwapSafe,
  omitRetiredHreflang,
  resolveLocaleSwitchPath,
  type LocaleSwitchInput,
} from "./locale-switch.js";
import { buildPageMetadata, copyContent, originFor, policyFor, tightenWithEditorial, withPagedTitle } from "./metadata.js";
import { normalizeSeoOptions, type NormalizedSeoOptions, type SeoOptions } from "./options.js";
import { isPaginationBeyondResults } from "./pagination.js";
import { applyPolicyMetadata, resolveCanonical, resolvePagePolicy } from "./policy.js";
import {
  indexVariantParents,
  productCanonicalSlug,
  productJsonLdSlug,
  sitemapProductSlug,
} from "./product-canonical.js";
import { productOpenGraphTags, type ProductOpenGraphPrice } from "./product-open-graph.js";
import { buildLaunchRobotsTxt, buildRobotsTxt, documentRobotsHeader, shouldAttachDocumentRobotsHeader } from "./robots.js";
import {
  dedupeSitemapEntries,
  publishSitemap,
  renderSitemapIndex,
  renderUrlSet,
  selectSitemapEntry,
  sitemapLastmod,
  type SitemapEntry,
} from "./sitemap.js";
import {
  buildBreadcrumbListJsonLd,
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildWebSiteJsonLd,
  serializeJsonLd,
  type BreadcrumbSchemaItem,
  type OrganizationSchemaInput,
  type ProductSchemaInput,
} from "./json-ld.js";
import {
  absoluteUrl,
  buildStorefrontPath,
  classifyQueryParam,
  resolveAlternates,
  resolveUrl,
} from "./url.js";

export type SeoApi = ReturnType<typeof defineSeo>;

/** Bind the SEO engine to one project's locales, routes, query rules, and policies. */
export function defineSeo(options: SeoOptions) {
  const normalized = normalizeSeoOptions(options);

  return {
    options: normalized,
    loadConfig(env: SeoEnv = {}) {
      return loadSeoConfig(env, normalized);
    },
    originFor(env?: SeoEnv) {
      return originFor(env, normalized);
    },
    isApprovedOrigin(origin: string) {
      return isApprovedProductionOrigin(origin, normalized);
    },
    validateRelease(env: SeoEnv = {}) {
      const config = loadSeoConfig(env, normalized);
      return validateReleaseConfig(config, normalized);
    },
    assertRelease(env: SeoEnv = {}) {
      assertReleaseConfig(loadSeoConfig(env, normalized), normalized);
    },
    launchPreviewAllowed(env: SeoEnv = {}) {
      const config = loadSeoConfig(env, normalized);
      return {
        staging: launchSeoPreviewAllowed(config),
        request: launchPreviewRequestAllowed(config, normalized),
      };
    },
    shouldPublishSitemap(env: SeoEnv = {}) {
      return shouldPublishSitemap(loadSeoConfig(env, normalized));
    },
    resolveUrl(
      input: Parameters<typeof resolveUrl>[0],
    ) {
      return resolveUrl(input, normalized);
    },
    buildStorefrontPath(locale: string, path: string) {
      return buildStorefrontPath(locale, path, normalized);
    },
    classifyQueryParam(
      name: string,
      value: string,
      context?: Parameters<typeof classifyQueryParam>[3],
    ) {
      return classifyQueryParam(name, value, normalized, context);
    },
    absoluteUrl,
    resolveAlternates(input: Parameters<typeof resolveAlternates>[0]) {
      return resolveAlternates(input, normalized);
    },
    policyFor(input: Parameters<typeof policyFor>[0]) {
      return policyFor(input, normalized);
    },
    resolvePagePolicy(input: Parameters<typeof resolvePagePolicy>[0]) {
      return resolvePagePolicy(input, normalized);
    },
    resolveCanonical(input: Omit<Parameters<typeof resolveCanonical>[0], "options">) {
      return resolveCanonical({ ...input, options: normalized });
    },
    applyPolicyMetadata,
    tightenWithEditorial,
    buildMetadata(input: Parameters<typeof buildPageMetadata>[0]) {
      return buildPageMetadata(input, normalized);
    },
    copyContent,
    withPagedTitle,
    mapLocaleContext(locale: string, env?: SeoEnv) {
      return mapLocaleContext(locale, normalized, env);
    },
    mapLanguageAlternates,
    publicCatalogPath,
    hreflangTag(locale: string) {
      return hreflangTag(locale, normalized);
    },
    omitRetiredHreflang(languages: Record<string, string> | undefined) {
      return omitRetiredHreflang(languages, normalized);
    },
    resolveLocaleSwitchPath(input: LocaleSwitchInput) {
      return resolveLocaleSwitchPath(input, normalized);
    },
    isPrefixSwapSafe(pathWithoutLocale: string) {
      return isPrefixSwapSafe(pathWithoutLocale, normalized);
    },
    buildRobotsTxt(env: SeoEnv = {}) {
      return buildRobotsTxt(loadSeoConfig(env, normalized));
    },
    buildLaunchRobotsTxt(env: SeoEnv = {}) {
      return buildLaunchRobotsTxt(loadSeoConfig(env, normalized));
    },
    documentRobotsHeader(env: SeoEnv = {}) {
      return documentRobotsHeader(loadSeoConfig(env, normalized));
    },
    shouldAttachDocumentRobotsHeader,
    selectSitemapEntry(input: Parameters<typeof selectSitemapEntry>[0]) {
      return selectSitemapEntry(input, normalized);
    },
    publishSitemap(
      origin: string,
      entries: readonly SitemapEntry[],
      limits?: Parameters<typeof publishSitemap>[3],
      indexPath?: string,
    ) {
      return publishSitemap(origin, entries, normalized, limits, indexPath);
    },
    dedupeSitemapEntries,
    renderUrlSet(entries: readonly SitemapEntry[]) {
      return renderUrlSet(entries, normalized);
    },
    renderSitemapIndex,
    sitemapLastmod,
    buildProductJsonLd(input: Parameters<typeof buildProductJsonLd>[0]) {
      return buildProductJsonLd(input, normalized);
    },
    buildBreadcrumbListJsonLd(input: {
      origin: string;
      locale: string;
      items: readonly BreadcrumbSchemaItem[];
      currentPath?: string | null;
    }) {
      return buildBreadcrumbListJsonLd(input, normalized);
    },
    buildOrganizationJsonLd(input: OrganizationSchemaInput) {
      return buildOrganizationJsonLd(input, normalized);
    },
    buildWebSiteJsonLd(input: { name: string; origin: string; locale: string }) {
      return buildWebSiteJsonLd(input, normalized);
    },
    serializeJsonLd,
    productOpenGraphTags,
    resolveSharingImage(
      input: {
        candidates: readonly SharingImageCandidate[];
        brand?: SharingImageCandidate | null;
        alt: string;
        brandName?: string;
      },
      env: SeoEnv = {},
    ) {
      const config = loadSeoConfig(env, normalized);
      return resolveSharingImage({
        ...input,
        mediaOrigins: config.mediaOrigins,
      });
    },
    plainText,
    presentText,
    composeTitle,
    composeDescription,
    editorialRobots,
    ignoredCanonical,
    qualityWarnings,
    productCanonicalSlug,
    productJsonLdSlug,
    sitemapProductSlug,
    indexVariantParents,
    isPaginationBeyondResults,
    publicCacheKey(identity: PublicCacheIdentity) {
      return publicCacheKey(identity, normalized);
    },
    storeViewForPublicCache(locale: string) {
      return storeViewForPublicCache(locale, normalized);
    },
    refreshesSitemap(tag: string) {
      return refreshesSitemap(tag, normalized);
    },
    takeRevalidationSlot,
  };
}

export type { NormalizedSeoOptions, ProductOpenGraphPrice, ProductSchemaInput, SeoOptions };
