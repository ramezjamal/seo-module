import { hasSignedQuery } from "./images.js";
import type { NormalizedSeoOptions } from "./options.js";

/**
 * Indexing configuration.
 * The canonical origin comes from configuration. Untrusted Host headers are ignored.
 */

export type DeploymentEnv = "local" | "preview" | "staging" | "production";

export type SeoConfig = {
  nodeEnv: string;
  deploymentEnv: DeploymentEnv;
  /** Raw `SEO_INDEXING_ENABLED=true` request. Not sufficient on its own. */
  indexingRequested: boolean;
  /** Effective gate. Production mode also requires `DEPLOYMENT_ENV=production`. */
  indexingEnabled: boolean;
  publicOrigin: string;
  originApproved: boolean;
  storeViewByLocale: Readonly<Record<string, string>>;
  /** Present only when the env var is an explicit `language_TERRITORY` value. */
  ogLocale: Partial<Record<string, string>>;
  mediaOrigins: readonly string[];
  /**
   * Approved brand card image. Set only from `SEO_DEFAULT_OG_IMAGE_URL`.
   * Width and height are set only when both are provided.
   */
  brandSharingImage: {
    url: string;
    width?: number;
    height?: number;
  } | null;
  brandNameByLocale: Readonly<Record<string, string>>;
  fallbackLocale: string;
};

export type SeoEnv = {
  NODE_ENV?: string;
  DEPLOYMENT_ENV?: string;
  SEO_INDEXING_ENABLED?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  SEO_MEDIA_ORIGINS?: string;
  SEO_DEFAULT_OG_IMAGE_URL?: string;
  SEO_DEFAULT_OG_IMAGE_WIDTH?: string;
  SEO_DEFAULT_OG_IMAGE_HEIGHT?: string;
} & Record<string, string | undefined>;

export type ReleaseValidation = { ok: true } | { ok: false; errors: string[] };

/** Fetch window already used by catalog and content reads. Not an approved freshness SLA. */
export const currentFetchRevalidateSeconds = 300;

export const approvedFreshnessSeconds: number | null = null;

/** Google sitemap file limits used by `publishSitemap`. */
export const sitemapFileLimits = {
  maxUrls: 50_000,
  maxUncompressedBytes: 50 * 1024 * 1024,
} as const;

const OG_LOCALE_PATTERN = /^[a-z]{2}_[A-Z]{2}$/;

export function isApprovedProductionOrigin(
  value: string,
  options: NormalizedSeoOptions,
): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.pathname !== "/" && url.pathname !== "") return false;
  if (url.search || url.hash) return false;
  if (options.blockedHosts.has(url.hostname)) return false;
  if (url.hostname === "example.com" || url.hostname.endsWith(".example.com")) {
    return false;
  }
  return true;
}

/** Canonical origin comes from configuration. Untrusted Host headers are ignored. */
export function publicOriginFromConfig(
  config: Pick<SeoConfig, "publicOrigin">,
  untrustedHost?: string | null,
): string {
  void untrustedHost;
  return config.publicOrigin;
}

/**
 * Origin for canonicals, hreflang, Open Graph URLs, and JSON-LD.
 * Null when the configured value is not an approved https origin.
 */
export function approvedCanonicalOrigin(
  config: Pick<SeoConfig, "publicOrigin" | "originApproved">,
  options: NormalizedSeoOptions,
  untrustedHost?: string | null,
): string | null {
  void options;
  if (!config.originApproved) return null;
  const origin = publicOriginFromConfig(config, untrustedHost);
  return origin || null;
}

/** The sitemap file is published only when indexing is on. */
export function shouldPublishSitemap(config: SeoConfig): boolean {
  return config.indexingEnabled;
}

/**
 * Staging-only preview of the launch robots.txt and sitemap.
 * Indexing stays off. Production, preview, and local hosts do not serve it.
 */
export function launchSeoPreviewAllowed(config: SeoConfig): boolean {
  return config.deploymentEnv === "staging";
}

/**
 * Launch preview while indexing is off.
 * Allowed for `DEPLOYMENT_ENV=staging`, or when the configured origin is one
 * of `origins.stagingOrigins`. Production with indexing on stays denied.
 */
export function launchPreviewRequestAllowed(
  config: SeoConfig,
  options: NormalizedSeoOptions,
): boolean {
  if (config.indexingEnabled) return false;
  return (
    config.deploymentEnv === "staging" || options.stagingOrigins.has(config.publicOrigin)
  );
}

export function loadSeoConfig(env: SeoEnv, options: NormalizedSeoOptions): SeoConfig {
  const nodeEnv = env.NODE_ENV?.trim() || "development";
  const deploymentEnv = parseDeploymentEnv(env.DEPLOYMENT_ENV);
  const indexingRequested = env.SEO_INDEXING_ENABLED?.trim() === "true";
  const publicOrigin = normalizeOrigin(env.NEXT_PUBLIC_SITE_URL);
  const originApproved = isApprovedProductionOrigin(publicOrigin, options);
  const indexingEnabled =
    indexingRequested &&
    originApproved &&
    (options.indexingGate === "requested" || deploymentEnv === "production");
  const mediaOrigins = readMediaOrigins(env.SEO_MEDIA_ORIGINS, options);

  return {
    nodeEnv,
    deploymentEnv,
    indexingRequested,
    indexingEnabled,
    publicOrigin,
    originApproved,
    storeViewByLocale: options.storeViewByLocale,
    ogLocale: readOgLocales(env, options),
    mediaOrigins,
    brandSharingImage: readBrandSharingImage(env, mediaOrigins),
    brandNameByLocale: options.brandName,
    fallbackLocale: options.defaultLocale,
  };
}

/**
 * Indexing requested without a trusted production deployment and an approved
 * origin fails validation. Leaving indexing off is valid.
 * `NODE_ENV` is not consulted. The `requested` gate does not require production.
 */
export function validateReleaseConfig(
  config: SeoConfig,
  options: NormalizedSeoOptions,
): ReleaseValidation {
  if (!config.indexingRequested) return { ok: true };

  const errors: string[] = [];
  if (options.indexingGate === "production" && config.deploymentEnv !== "production") {
    errors.push(
      `SEO_INDEXING_ENABLED is true but DEPLOYMENT_ENV is ${config.deploymentEnv}. NODE_ENV=${config.nodeEnv} does not enable indexing.`,
    );
  }
  if (!config.originApproved) {
    errors.push(
      `SEO_INDEXING_ENABLED is true but NEXT_PUBLIC_SITE_URL is not an approved https origin (${config.publicOrigin || "empty"}).`,
    );
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function assertReleaseConfig(config: SeoConfig, options: NormalizedSeoOptions): void {
  const result = validateReleaseConfig(config, options);
  if (!result.ok) {
    throw new Error(result.errors.join(" "));
  }
}

function parseDeploymentEnv(value: string | undefined): DeploymentEnv {
  switch (value?.trim()) {
    case "preview":
    case "staging":
    case "production":
    case "local":
      return value.trim() as DeploymentEnv;
    default:
      return "local";
  }
}

function normalizeOrigin(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function readOgLocales(
  env: SeoEnv,
  options: NormalizedSeoOptions,
): Partial<Record<string, string>> {
  const ogLocale: Partial<Record<string, string>> = {};
  for (const locale of options.localeList) {
    const envName = options.ogLocaleEnv[locale];
    const value = envName ? env[envName]?.trim() : undefined;
    if (value && OG_LOCALE_PATTERN.test(value)) ogLocale[locale] = value;
  }
  return ogLocale;
}

function readBrandSharingImage(
  env: SeoEnv,
  mediaOrigins: readonly string[],
): SeoConfig["brandSharingImage"] {
  const raw = env.SEO_DEFAULT_OG_IMAGE_URL?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (!mediaOrigins.includes(url.origin) || hasSignedQuery(url)) return null;
  url.hash = "";
  const width = positiveDimension(env.SEO_DEFAULT_OG_IMAGE_WIDTH);
  const height = positiveDimension(env.SEO_DEFAULT_OG_IMAGE_HEIGHT);
  return {
    url: url.toString(),
    ...(width && height ? { width, height } : {}),
  };
}

function positiveDimension(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return parsed > 0 ? parsed : undefined;
}

function readMediaOrigins(
  value: string | undefined,
  options: NormalizedSeoOptions,
): readonly string[] {
  const trimmed = value?.trim();
  if (!trimmed) return options.mediaOrigins;
  return trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => isApprovedProductionOrigin(entry, options));
}
