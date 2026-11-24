export { defineSeo, type SeoApi } from "./define-seo.js";
export type { SeoOptions, PagePolicyTemplate, NormalizedSeoOptions } from "./options.js";
export { normalizeSeoOptions } from "./options.js";

export type {
  CanonicalDecision,
  ClassifiedParam,
  JsonValue,
  LanguageAlternate,
  QueryParamClass,
  RobotsDirective,
  StockStatus,
} from "./types.js";

export {
  absoluteUrl,
  buildStorefrontPath,
  classifyQueryParam,
  hasInvalidPageQuery,
  includeOnIdentityUrl,
  resolveAlternates,
  resolveUrl,
  UrlResolveError,
  validPageValue,
} from "./url.js";
export type { StorefrontPath, UrlResolution } from "./url.js";

export {
  applyPolicyMetadata,
  resolveCanonical,
  resolvePagePolicy,
} from "./policy.js";
export type { PagePolicy, PagePolicyInput } from "./policy.js";

export {
  approvedCanonicalOrigin,
  approvedFreshnessSeconds,
  assertReleaseConfig,
  currentFetchRevalidateSeconds,
  isApprovedProductionOrigin,
  launchPreviewRequestAllowed,
  launchSeoPreviewAllowed,
  loadSeoConfig,
  publicOriginFromConfig,
  shouldPublishSitemap,
  sitemapFileLimits,
  validateReleaseConfig,
} from "./config.js";
export type { DeploymentEnv, ReleaseValidation, SeoConfig, SeoEnv } from "./config.js";

export {
  buildPageMetadata,
  copyContent,
  originFor,
  policyFor,
  tightenWithEditorial,
  withPagedTitle,
} from "./metadata.js";
export type { PolicyContext } from "./metadata.js";

export {
  buildLaunchRobotsTxt,
  buildRobotsTxt,
  documentRobotsHeader,
  shouldAttachDocumentRobotsHeader,
} from "./robots.js";

export {
  dedupeSitemapEntries,
  escapeXml,
  publishSitemap,
  renderSitemapIndex,
  renderUrlSet,
  selectSitemapEntry,
  sitemapLastmod,
} from "./sitemap.js";
export type { SitemapEntry, SitemapFile, SitemapPublication } from "./sitemap.js";

export {
  buildBreadcrumbListJsonLd,
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildWebSiteJsonLd,
  serializeJsonLd,
} from "./json-ld.js";
export type {
  BreadcrumbSchemaItem,
  OrganizationSchemaInput,
  ProductSchemaInput,
  SellerOfferSchemaInput,
} from "./json-ld.js";

export { JsonLdScript } from "./json-ld-script.js";
export { ProductOpenGraph } from "./product-open-graph-meta.js";
export { productOpenGraphTags } from "./product-open-graph.js";
export type { ProductOpenGraphPrice, ProductOpenGraphTag } from "./product-open-graph.js";

export { hasSignedQuery, resolveSharingImage } from "./images.js";
export type {
  SharingImage,
  SharingImageCandidate,
  SharingImageSource,
  SharingMimeType,
} from "./images.js";

export {
  DESCRIPTION_WARNING_LENGTH,
  NAMED_ENTITIES,
  TITLE_WARNING_LENGTH,
  composeDescription,
  composeTitle,
  editorialRobots,
  ignoredCanonical,
  plainText,
  presentText,
  qualityWarnings,
} from "./content.js";
export type { SeoAdaptedContent } from "./content.js";

export { mapLanguageAlternates, mapLocaleContext, publicCatalogPath } from "./locale.js";
export type { LocaleContext } from "./locale.js";

export {
  hreflangTag,
  isPrefixSwapSafe,
  omitRetiredHreflang,
  resolveLocaleSwitchPath,
} from "./locale-switch.js";
export type { LocaleSwitchInput } from "./locale-switch.js";

export {
  indexVariantParents,
  productCanonicalSlug,
  productJsonLdSlug,
  sitemapProductSlug,
} from "./product-canonical.js";
export type { VariantParentRow } from "./product-canonical.js";

export { isPaginationBeyondResults } from "./pagination.js";

export {
  failureRetryAfterSeconds,
  isScopedPath,
  isScopedTag,
  publicCacheKey,
  refreshesSitemap,
  sitemapCacheTag,
  sitemapRevalidateSeconds,
  storeViewForPublicCache,
  takeRevalidationSlot,
} from "./cache.js";
export type { PublicCacheIdentity } from "./cache.js";
