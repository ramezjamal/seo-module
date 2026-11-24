import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  JsonLdScript,
  ProductOpenGraph,
  absoluteUrl,
  composeDescription,
  composeTitle,
  defineSeo,
  ignoredCanonical,
  indexVariantParents,
  isPaginationBeyondResults,
  plainText,
  productCanonicalSlug,
  productJsonLdSlug,
  qualityWarnings,
  type SeoOptions,
} from "../src/index.ts";

const options: SeoOptions = {
  locales: ["en", "ar"],
  defaultLocale: "ar",
  publicLocales: ["ar"],
  localePresentation: {
    en: { htmlLang: "en", direction: "ltr" },
    ar: { htmlLang: "ar", direction: "rtl" },
  },
  hreflang: { en: "en-GB", ar: "ar-KW" },
  retiredHreflang: ["en", "en-GB", "x-default"],
  brandName: { en: "Example", ar: "Example" },
  paths: {
    legacyPrefixes: ["c", "p", "b"],
    prefixSwapSafe: ["help", "search"],
  },
  query: {
    tracking: ["gclid", "fbclid"],
    facets: ["color", "rating"],
    preview: ["pbPreview"],
    display: ["pageSize", "view"],
    variant: ["color", "size"],
    variantPageKinds: ["product"],
    searchIdentity: ["q"],
    searchPageKinds: ["search"],
  },
  policies: {
    home: { kind: "public" },
    product: { kind: "public" },
    category: { kind: "public" },
    search: {
      kind: "fixed",
      robots: { index: false, follow: true },
      canonical: "omit",
      sitemapEligible: false,
      httpStatus: 200,
    },
    auth: {
      kind: "fixed",
      robots: { index: false, follow: false },
      canonical: "omit",
      sitemapEligible: false,
      httpStatus: 200,
    },
    cms: { kind: "public-when-published" },
    failure: {
      kind: "fixed",
      robots: { index: false, follow: false },
      canonical: "omit",
      sitemapEligible: false,
      httpStatus: 503,
    },
  },
  mediaOrigins: ["https://cdn.example.net"],
  sitemapTagPrefixes: ["catalog:product:"],
  origins: {
    blockedHosts: ["admin.example.net"],
    stagingOrigins: ["https://staging.example.net"],
  },
};

const seo = defineSeo(options);
const origin = "https://shop.example.net";

test("storefront paths drop one legacy prefix and reject .html", () => {
  assert.equal(seo.buildStorefrontPath("ar", "/c/robe").pathname, "/ar/robe");
  assert.equal(seo.buildStorefrontPath("ar", "robe/").pathname, "/ar/robe");
  assert.throws(() => seo.buildStorefrontPath("ar", "/robe.html"), /html/);
  assert.throws(() => seo.buildStorefrontPath("fr", "/robe"), /Unsupported locale/);
});

test("invalid page is not coerced to 1", () => {
  for (const page of ["0", "-1", "1.5", "two", ""]) {
    const url = seo.resolveUrl({
      locale: "ar",
      path: "/robe",
      searchParams: { page },
      pageKind: "category",
    });
    assert.equal(url.invalidPage, true, page);
    assert.equal(url.paginationPage, null);
  }
  const valid = seo.resolveUrl({
    locale: "ar",
    path: "/robe",
    searchParams: { page: "2" },
    pageKind: "category",
  });
  assert.equal(valid.invalidPage, false);
  assert.equal(valid.paginationPage, 2);
});

test("tracking, display, and product variants consolidate; facets and search do not", () => {
  const tracked = seo.resolveUrl({
    locale: "ar",
    path: "/robe",
    searchParams: { utm_source: "ad", gclid: "1" },
    pageKind: "product",
  });
  assert.equal(tracked.trackingOnlyVariant, true);
  assert.equal(tracked.consolidatingVariant, true);

  const variant = seo.resolveUrl({
    locale: "ar",
    path: "/robe",
    searchParams: { color: "blue", pageSize: "12" },
    pageKind: "product",
  });
  assert.equal(variant.hasVariant, true);
  assert.equal(variant.hasDisplay, true);
  assert.equal(variant.hasFacet, false);

  const facet = seo.resolveUrl({
    locale: "ar",
    path: "/robes",
    searchParams: { color: "blue" },
    pageKind: "category",
  });
  assert.equal(facet.hasFacet, true);
  assert.equal(facet.consolidatingVariant, false);

  const search = seo.resolveUrl({
    locale: "ar",
    path: "/search",
    searchParams: { q: "robe" },
    pageKind: "search",
  });
  assert.equal(search.params[0]?.class, "search-identity");
});

test("missing language counterparts are omitted and the homepage is not substituted", () => {
  const alternates = seo.resolveAlternates({
    origin,
    current: { locale: "ar", path: "/ar/robe" },
    counterparts: { en: null },
  });
  assert.deepEqual(
    alternates.map((item) => item.hreflang),
    ["ar"],
  );
  assert.equal(alternates.some((item) => item.url.endsWith("/en")), false);

  const paired = seo.resolveAlternates({
    origin,
    current: { locale: "ar", path: "/ar/robe" },
    counterparts: { en: "/en/gown" },
  });
  assert.equal(paired.find((item) => item.hreflang === "en")?.url, `${origin}/en/gown`);
});

test("policy gates: invalid page, facets, unpublished CMS, and indexing off", () => {
  const invalid = seo.policyFor({
    kind: "category",
    locale: "ar",
    path: "/robes",
    searchParams: { page: "0" },
  });
  assert.equal(invalid.policy.httpStatus, 404);
  assert.equal(invalid.policy.canonical, "omit");

  const faceted = seo.policyFor({
    kind: "category",
    locale: "ar",
    path: "/robes",
    searchParams: { rating: "4" },
    env: {
      SEO_INDEXING_ENABLED: "true",
      DEPLOYMENT_ENV: "production",
      NEXT_PUBLIC_SITE_URL: origin,
    },
  });
  assert.equal(faceted.policy.robots?.index, false);
  assert.equal(faceted.policy.robots?.follow, true);
  assert.equal(faceted.policy.canonical, "omit");
  assert.equal(faceted.policy.sitemapEligible, false);

  const unpublished = seo.resolvePagePolicy({
    kind: "cms",
    indexingEnabled: true,
    published: false,
    url: seo.resolveUrl({ locale: "ar", path: "/help", pageKind: "cms" }),
  });
  assert.equal(unpublished.canonical, "omit");
  assert.equal(unpublished.httpStatus, 200);

  const home = seo.policyFor({
    kind: "home",
    locale: "ar",
    path: "/",
    env: { SEO_INDEXING_ENABLED: "true", DEPLOYMENT_ENV: "staging", NEXT_PUBLIC_SITE_URL: origin },
  });
  assert.equal(home.policy.robots?.index, false);
  assert.equal(home.policy.robots?.follow, true);
  assert.equal(home.policy.sitemapEligible, true);
});

test("indexing requires the flag, production, and an approved https origin", () => {
  const off = seo.loadConfig({
    NODE_ENV: "production",
    SEO_INDEXING_ENABLED: "true",
    DEPLOYMENT_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "http://shop.example.net",
  });
  assert.equal(off.indexingEnabled, false);
  assert.equal(seo.originFor({ NEXT_PUBLIC_SITE_URL: "https://localhost" }), null);
  assert.equal(seo.isApprovedOrigin("https://admin.example.net"), false);

  const on = seo.loadConfig({
    SEO_INDEXING_ENABLED: "true",
    DEPLOYMENT_ENV: "production",
    NEXT_PUBLIC_SITE_URL: `${origin}/`,
  });
  assert.equal(on.indexingEnabled, true);
  assert.equal(on.publicOrigin, origin);
  assert.equal(on.ogLocale.ar, undefined);

  const og = seo.loadConfig({
    SEO_OG_LOCALE_AR: "ar_KW",
    SEO_OG_LOCALE_EN: "en-GB",
  });
  assert.equal(og.ogLocale.ar, "ar_KW");
  assert.equal(og.ogLocale.en, undefined);

  const release = seo.validateRelease({
    SEO_INDEXING_ENABLED: "true",
    DEPLOYMENT_ENV: "staging",
    NEXT_PUBLIC_SITE_URL: origin,
  });
  assert.equal(release.ok, false);
});

test("an untrusted host does not replace the configured origin", () => {
  const config = seo.loadConfig({ NEXT_PUBLIC_SITE_URL: origin });
  assert.equal(seo.originFor({ NEXT_PUBLIC_SITE_URL: origin }), origin);
  assert.equal(config.publicOrigin, origin);
});

test("robots.txt is closed until indexing is on, then points at the sitemap index", () => {
  const closed = seo.buildRobotsTxt();
  assert.match(closed, /Disallow: \//);
  assert.doesNotMatch(closed, /Sitemap:/);
  assert.equal(seo.documentRobotsHeader(), "noindex");

  const open = seo.buildRobotsTxt({
    SEO_INDEXING_ENABLED: "true",
    DEPLOYMENT_ENV: "production",
    NEXT_PUBLIC_SITE_URL: origin,
  });
  assert.match(open, /Allow: \//);
  assert.match(open, new RegExp(`Sitemap: ${origin}/sitemap_index.xml`));
  assert.equal(
    seo.documentRobotsHeader({
      SEO_INDEXING_ENABLED: "true",
      DEPLOYMENT_ENV: "production",
      NEXT_PUBLIC_SITE_URL: origin,
    }),
    null,
  );
  assert.equal(seo.shouldAttachDocumentRobotsHeader("/robe.jpg"), false);
  assert.equal(seo.shouldAttachDocumentRobotsHeader("/ar/robe"), true);
});

test("sitemap selection, lastmod, splitting, and empty refusal", () => {
  const home = seo.selectSitemapEntry({
    origin,
    locale: "ar",
    path: "/",
    kind: "home",
    group: "content",
    lastmod: "2026-01-02 03:04:05",
  });
  assert.equal(home?.loc, `${origin}/ar`);
  assert.equal(home?.lastmod, "2026-01-02T03:04:05+00:00");

  assert.equal(
    seo.selectSitemapEntry({
      origin,
      locale: "en",
      path: "/",
      kind: "home",
      group: "content",
    }),
    null,
  );
  assert.equal(
    seo.selectSitemapEntry({
      origin,
      locale: "ar",
      path: "/robes",
      kind: "category",
      group: "categories",
      searchParams: { page: "2" },
    }),
    null,
  );

  const entries = Array.from({ length: 3 }, (_, index) => ({
    loc: `${origin}/ar/item-${index}`,
    locale: "ar",
    group: "products",
  }));
  const published = seo.publishSitemap(origin, entries, { maxUrls: 2, maxUncompressedBytes: 50_000_000 });
  assert.equal(published.kind, "index");
  if (published.kind !== "index") return;
  assert.equal(published.files.length, 2);
  assert.match(published.files[0]!.name, /^products-ar/);
  assert.match(published.xml, /sitemapindex/);
  assert.throws(() => seo.publishSitemap(origin, []), /empty sitemap/);
});

test("metadata maps robots, canonical, and hreflang without a product price tag", () => {
  const { url, policy } = seo.policyFor({
    kind: "product",
    locale: "ar",
    path: "/robe",
    env: {
      SEO_INDEXING_ENABLED: "true",
      DEPLOYMENT_ENV: "production",
      NEXT_PUBLIC_SITE_URL: origin,
    },
  });
  const metadata = seo.buildMetadata({
    content: {
      kind: "product",
      locale: "ar",
      storeView: "ar",
      htmlLang: "ar",
      direction: "rtl",
      hreflang: "ar",
      entityKey: "robe",
      publicPath: "/ar/robe",
      title: "Robe",
      titleFrom: "name",
      brandAppended: false,
      titleContainsBrand: false,
      descriptionFrom: "none",
      ogTitle: "Robe",
      published: true,
      warnings: [],
    },
    policy,
    origin,
    url,
    alternates: [{ hreflang: "en", url: `${origin}/en/gown` }],
    productOffer: null,
  });
  assert.equal(
    metadata.alternates && "canonical" in metadata.alternates
      ? metadata.alternates.canonical
      : undefined,
    `${origin}/ar/robe`,
  );
  assert.equal(metadata.openGraph?.type, undefined);
  const hidden = metadata.alternates && "languages" in metadata.alternates
    ? metadata.alternates.languages
    : undefined;
  assert.equal(hidden, undefined);

  const bilingual = defineSeo({
    ...options,
    publicLocales: ["en", "ar"],
    retiredHreflang: [],
  });
  const resolved = bilingual.policyFor({
    kind: "product",
    locale: "ar",
    path: "/robe",
    env: {
      SEO_INDEXING_ENABLED: "true",
      DEPLOYMENT_ENV: "production",
      NEXT_PUBLIC_SITE_URL: origin,
    },
  });
  const withLanguages = bilingual.buildMetadata({
    content: {
      kind: "product",
      locale: "ar",
      storeView: "ar",
      htmlLang: "ar",
      direction: "rtl",
      hreflang: "ar",
      entityKey: "robe",
      publicPath: "/ar/robe",
      title: "Robe",
      titleFrom: "name",
      brandAppended: false,
      titleContainsBrand: false,
      descriptionFrom: "none",
      ogTitle: "Robe",
      published: true,
      warnings: [],
    },
    policy: resolved.policy,
    origin,
    url: resolved.url,
    alternates: [{ hreflang: "en", url: `${origin}/en/gown` }],
    productOffer: null,
  });
  const languages =
    withLanguages.alternates && "languages" in withLanguages.alternates
      ? withLanguages.alternates.languages
      : undefined;
  assert.equal(languages?.["ar-KW"], `${origin}/ar/robe`);
  assert.equal(languages?.["en-GB"], `${origin}/en/gown`);
});

test("JSON-LD offer, parent, rating, and script escaping", () => {
  const product = seo.buildProductJsonLd({
    origin,
    locale: "ar",
    product: {
      id: "1",
      slug: "robe",
      title: "Robe <script>",
      description: "Soft &amp; warm",
      price: { amount: 12.5, currency: "KWD" },
      stockStatus: "in_stock",
      rating: 4.5,
      reviewCount: 3,
    },
  });
  assert.equal(product && "offers" in product ? (product.offers as { price: number }).price : null, 12.5);
  assert.match(seo.serializeJsonLd(product!), /\\u003c/);
  assert.doesNotMatch(seo.serializeJsonLd(product!), /<script/);

  const parent = seo.buildProductJsonLd({
    origin,
    locale: "ar",
    product: {
      id: "2",
      slug: "robe",
      title: "Robe",
      isParent: true,
      price: { amount: 12, currency: "KWD" },
      stockStatus: "in_stock",
    },
  });
  assert.ok(parent);
  assert.equal("offers" in parent, false);

  const badRating = seo.buildProductJsonLd({
    origin,
    locale: "ar",
    product: { id: "3", slug: "robe", title: "Robe", rating: 4, reviewCount: 0 },
  });
  assert.equal(badRating && "aggregateRating" in badRating, false);

  const html = renderToStaticMarkup(
    JsonLdScript({ data: { "@type": "Thing", name: "A < B" } }),
  );
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /\\u003c/);
});

test("sharing images reject signed and off-origin URLs and do not invent dimensions", () => {
  const signed = seo.resolveSharingImage(
    {
      candidates: [{ url: "https://cdn.example.net/a.jpg?X-Amz-Signature=abc", alt: "A" }],
      alt: "A",
    },
    { SEO_MEDIA_ORIGINS: "https://cdn.example.net" },
  );
  assert.equal(signed.image, undefined);
  assert.ok(signed.warnings.includes("image-signed-url-rejected"));

  const ok = seo.resolveSharingImage(
    {
      candidates: [{ url: "https://cdn.example.net/a.png", width: 10, height: null }],
      alt: "A",
    },
    { SEO_MEDIA_ORIGINS: "https://cdn.example.net" },
  );
  assert.equal(ok.image?.width, undefined);
  assert.equal(ok.image?.mimeType, "image/png");
  assert.ok(ok.warnings.includes("sharing-image-dimensions-unknown"));
});

test("titles, descriptions, and source canonicals", () => {
  const branded = composeTitle(null, "Robe", "Example");
  assert.equal(branded?.title, "Robe | Example");
  assert.equal(branded?.brandAppended, true);
  const editorial = composeTitle("Robe Example", "Other", "Example");
  assert.equal(editorial?.title, "Robe Example");
  assert.equal(editorial?.brandAppended, false);
  assert.deepEqual(composeDescription(null, " short ", "body"), {
    description: "short",
    descriptionFrom: "short",
  });
  assert.equal(ignoredCanonical(" https://elsewhere.example/robe "), "https://elsewhere.example/robe");
  assert.deepEqual(qualityWarnings("x".repeat(71), "y".repeat(161)), [
    "title-length",
    "description-length",
  ]);
  assert.equal(plainText("Soft &amp; <b>warm</b>"), "Soft & warm");
});

test("product price meta tags and canonical slugs", () => {
  const markup = renderToStaticMarkup(ProductOpenGraph({ price: { amount: 9, currency: "KWD" } }));
  assert.match(markup, /property="product:price:amount"/);
  assert.match(markup, /content="9"/);
  assert.equal(productOpenGraphWithoutPrice(), true);
  assert.equal(productCanonicalSlug("child", "parent"), "parent");
  assert.equal(productCanonicalSlug("plain", "plain"), "plain");
  assert.equal(productJsonLdSlug("child", "  "), "child");
  assert.equal(productJsonLdSlug("child", "parent"), "parent");
});

function productOpenGraphWithoutPrice(): boolean {
  const markup = renderToStaticMarkup(ProductOpenGraph({ price: { amount: Number.NaN, currency: "KWD" } }));
  return !markup.includes("product:price:amount") && markup.includes('property="og:type"');
}

test("pagination and cache identity", () => {
  assert.equal(isPaginationBeyondResults(3, 2), true);
  assert.equal(isPaginationBeyondResults(2, 2), false);
  assert.equal(isPaginationBeyondResults(0, 2), false);

  const english = seo.publicCacheKey({
    origin,
    locale: "en",
    storeView: "en",
    entity: "robe",
    page: 2,
    currency: "KWD",
  });
  const arabic = seo.publicCacheKey({
    origin,
    locale: "ar",
    storeView: "ar",
    entity: "robe",
  });
  assert.notEqual(english, arabic);
  assert.match(english, /page:2/);
  assert.match(arabic, /currency:-/);
  assert.equal(seo.refreshesSitemap("seo:sitemap"), true);
  assert.equal(seo.refreshesSitemap("catalog:product:1"), true);
  assert.equal(seo.refreshesSitemap("other:tag"), false);

  const blocked = seo.takeRevalidationSlot(1_000, Array.from({ length: 60 }, () => 1_000));
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1);
});

test("locale switch prefers a real alternate, then a safe prefix, then home", () => {
  assert.equal(
    seo.resolveLocaleSwitchPath({
      nextLocale: "en",
      pathname: "/ar/robe",
      alternateHref: "https://shop.example.net/en/gown?color=blue",
    }),
    "/en/gown",
  );
  assert.equal(
    seo.resolveLocaleSwitchPath({ nextLocale: "en", pathname: "/ar/help" }),
    "/en/help",
  );
  assert.equal(
    seo.resolveLocaleSwitchPath({ nextLocale: "en", pathname: "/ar/robe" }),
    "/en",
  );
});

test("caller facet codes are facets, and identity URLs drop display, variant, and tracking", () => {
  const faceted = seo.resolveUrl({
    locale: "ar",
    path: "/robes",
    searchParams: { material: "cotton" },
    pageKind: "category",
    facetAttributeCodes: ["material"],
  });
  assert.equal(faceted.params[0]?.class, "facet");

  const listing = seo.resolveUrl({
    locale: "ar",
    path: "/robes",
    searchParams: { view: "grid", pageSize: "24", page: "2", utm_source: "ad" },
    pageKind: "category",
  });
  assert.equal(listing.consolidatingVariant, true);
  assert.equal(
    absoluteUrl(origin, listing.pathname, listing.params),
    `${origin}/ar/robes?page=2`,
  );
});

test("a nofollow policy is not turned into follow, and a bad origin omits the canonical", () => {
  const auth = seo.policyFor({
    kind: "auth",
    locale: "ar",
    path: "/account",
    searchParams: { color: "blue" },
    env: {
      SEO_INDEXING_ENABLED: "true",
      DEPLOYMENT_ENV: "production",
      NEXT_PUBLIC_SITE_URL: origin,
    },
  });
  assert.equal(auth.policy.robots?.follow, false);
  assert.equal(auth.policy.canonical, "omit");

  const local = seo.resolveCanonical({
    origin: "https://localhost",
    url: seo.resolveUrl({ locale: "ar", path: "/robe", pageKind: "product" }),
    policy: {
      robots: { index: true, follow: true },
      canonical: "self",
      sitemapEligible: true,
      httpStatus: 200,
    },
  });
  assert.equal(local.mode, "omit");
});

test("variant parents use the supplied child slug property", () => {
  const rows = indexVariantParents(
    "robe",
    JSON.stringify({ variants: [{ url_key: "robe-blue" }, { slug: "ignored" }] }),
    "url_key",
  );
  assert.deepEqual(rows, [{ childSlug: "robe-blue", parentSlug: "robe" }]);
  assert.deepEqual(indexVariantParents("robe", "{\"variants\":[]}", ""), []);
});

test("launch preview stays off when indexing is enabled", () => {
  const preview = seo.launchPreviewAllowed({
    DEPLOYMENT_ENV: "staging",
    NEXT_PUBLIC_SITE_URL: "https://staging.example.net",
  });
  assert.equal(preview.staging, true);
  assert.equal(preview.request, true);
  const live = seo.launchPreviewAllowed({
    SEO_INDEXING_ENABLED: "true",
    DEPLOYMENT_ENV: "production",
    NEXT_PUBLIC_SITE_URL: origin,
  });
  assert.equal(live.request, false);
});
