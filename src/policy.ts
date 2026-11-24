import type { Metadata } from "next";

import { isApprovedProductionOrigin } from "./config.js";
import type { NormalizedSeoOptions } from "./options.js";
import type { PagePolicyTemplate } from "./options.js";
import type { CanonicalDecision, RobotsDirective } from "./types.js";
import { absoluteUrl, type UrlResolution } from "./url.js";

export type PagePolicy = {
  /**
   * Null only when the caller must not invent a robots tag.
   * A backend failure still sets noindex on the 503 page so the outage is not indexed.
   */
  robots: RobotsDirective | null;
  canonical: "self" | "omit";
  sitemapEligible: boolean;
  /** 404 for a confirmed miss, 503 for backend failure, 200 otherwise. */
  httpStatus: 200 | 404 | 503;
};

export type PagePolicyInput = {
  kind: string;
  /** Effective deployment gate from `loadSeoConfig`. */
  indexingEnabled: boolean;
  /** Public seller and CMS are indexable only when publication is confirmed. */
  published?: boolean;
  url: Pick<
    UrlResolution,
    | "paginationPage"
    | "hasFacet"
    | "hasSort"
    | "hasListingControl"
    | "hasPreview"
    | "hasUnresolved"
    | "trackingOnlyVariant"
    | "invalidPage"
  >;
};

const INDEX_FOLLOW: RobotsDirective = {
  index: true,
  follow: true,
  maxImagePreview: "large",
};

const NOINDEX_FOLLOW: RobotsDirective = {
  index: false,
  follow: true,
};

/**
 * Confirmed rules: search, facets, and sort are noindex, follow.
 * A confirmed miss is HTTP 404. A backend failure is HTTP 503.
 * The page-kind table comes from configuration.
 */
export function resolvePagePolicy(
  input: PagePolicyInput,
  options: NormalizedSeoOptions,
): PagePolicy {
  if (input.url.invalidPage) {
    return {
      robots: NOINDEX_FOLLOW,
      canonical: "omit",
      sitemapEligible: false,
      httpStatus: 404,
    };
  }
  const base = basePolicy(input, options);
  if (base.httpStatus !== 200 || !base.robots) return base;

  const narrowed = applyQueryModifiers(base, input);
  if (!narrowed.robots) return narrowed;
  return {
    ...narrowed,
    robots: applyDeploymentGate(narrowed.robots, input.indexingEnabled),
  };
}

export function applyPolicyMetadata(metadata: Metadata, policy: PagePolicy): Metadata {
  const robots = policy.robots
    ? {
        index: policy.robots.index,
        follow: policy.robots.follow,
        ...(policy.robots.maxImagePreview
          ? { maxImagePreview: policy.robots.maxImagePreview }
          : {}),
      }
    : undefined;
  const { alternates, ...rest } = metadata;
  return {
    ...rest,
    robots,
    ...(policy.canonical === "omit" || !alternates ? {} : { alternates }),
  };
}

export function resolveCanonical(input: {
  origin: string;
  url: UrlResolution;
  policy: PagePolicy;
  options: NormalizedSeoOptions;
}): CanonicalDecision {
  if (input.policy.canonical === "omit") return { mode: "omit" };
  if (!isApprovedProductionOrigin(input.origin, input.options)) return { mode: "omit" };

  const url = absoluteUrl(input.origin, input.url.pathname, input.url.params);
  if (input.url.consolidatingVariant) {
    return { mode: "consolidate", url };
  }
  return { mode: "self", url };
}

function basePolicy(input: PagePolicyInput, options: NormalizedSeoOptions): PagePolicy {
  const template: PagePolicyTemplate | undefined = options.policies[input.kind];
  if (!template) {
    throw new Error(`No SEO policy configured for page kind: ${input.kind}`);
  }
  if (template.kind === "fixed") {
    return {
      robots: template.robots,
      canonical: template.canonical,
      sitemapEligible: template.sitemapEligible,
      httpStatus: template.httpStatus,
    };
  }
  if (template.kind === "public-when-published" && !input.published) {
    return {
      robots: NOINDEX_FOLLOW,
      canonical: "omit",
      sitemapEligible: false,
      httpStatus: 200,
    };
  }
  return publicIndexable(input);
}

function publicIndexable(input: PagePolicyInput): PagePolicy {
  const page = input.url.paginationPage;
  const paged = page != null && page > 1;
  return {
    robots: INDEX_FOLLOW,
    canonical: "self",
    sitemapEligible: !paged,
    httpStatus: 200,
  };
}

function applyQueryModifiers(policy: PagePolicy, input: PagePolicyInput): PagePolicy {
  if (!policy.robots || policy.robots.follow === false) return policy;

  const { url } = input;
  if (url.hasFacet || url.hasSort || url.hasListingControl || url.hasPreview) {
    return {
      robots: { ...NOINDEX_FOLLOW },
      canonical: "omit",
      sitemapEligible: false,
      httpStatus: 200,
    };
  }

  return policy;
}

function applyDeploymentGate(
  robots: RobotsDirective,
  indexingEnabled: boolean,
): RobotsDirective {
  if (indexingEnabled || !robots.index) return robots;
  return { index: false, follow: robots.follow };
}
