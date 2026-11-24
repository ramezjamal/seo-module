# @ramezjamal/seo-module

Configurable SEO helpers for Next.js App Router projects. The engine covers metadata, canonical and hreflang URLs, indexing policy, `robots.txt`, sitemap XML, Open Graph product prices, and JSON-LD.

Locales, domains, brand names, routes, query rules, and page policies are arguments. The package does not ship a storefront's hosts, brand, or route matrix.

## Install

This package is published to GitHub Packages. In the app, add an `.npmrc`:

```ini
@ramezjamal:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

`NODE_AUTH_TOKEN` is a GitHub personal access token with `read:packages`. Then:

```bash
npm install @ramezjamal/seo-module
```

`next`, `react`, and `react-dom` stay in the app. They are peer dependencies.

## Configure

```ts
import { defineSeo } from "@ramezjamal/seo-module";

export const seo = defineSeo({
  locales: ["en", "ar"],
  defaultLocale: "ar",
  publicLocales: ["ar"],
  localePresentation: {
    en: { htmlLang: "en", direction: "ltr" },
    ar: { htmlLang: "ar", direction: "rtl" },
  },
  hreflang: { en: "en-GB", ar: "ar-KW" },
  brandName: { en: "Example", ar: "Example" },
  paths: {
    legacyPrefixes: ["c", "p", "b"],
    prefixSwapSafe: ["help", "search", "cart"],
  },
  query: {
    tracking: ["gclid", "fbclid"],
    facets: ["color", "size", "rating"],
    preview: ["pbPreview"],
    display: ["pageSize", "view", "order"],
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
    cms: { kind: "public-when-published" },
  },
  mediaOrigins: ["https://cdn.example.net"],
  sitemapTagPrefixes: ["catalog:product:"],
  origins: {
    blockedHosts: ["admin.example.net"],
    stagingOrigins: ["https://staging.example.net"],
  },
});
```

Policy templates:

- `public` — indexable. Page 2 and later keep a self canonical and stay out of the sitemap.
- `public-when-published` — the public rule only when `published` is true. Otherwise noindex, canonical omitted, HTTP 200.
- `fixed` — the robots, canonical, sitemap, and status you pass. Statuses other than 200 are not changed by query or indexing modifiers.

Indexing turns on only when `SEO_INDEXING_ENABLED=true`, `DEPLOYMENT_ENV=production`, and `NEXT_PUBLIC_SITE_URL` is an approved `https` origin. `NODE_ENV` does not enable indexing. Set `indexingGate: "requested"` to skip the production check. `localhost`, `127.0.0.1`, and `example.com` are always blocked. Add other hosts in `origins.blockedHosts`.

Open Graph locales are read from `SEO_OG_LOCALE_<LOCALE>` and must look like `ar_KW`. Hyphen tags are ignored. A brand sharing image is used only when `SEO_DEFAULT_OG_IMAGE_URL` is an allowlisted `https` URL. There is no built-in logo.

## Use

### Page metadata

```ts
export async function generateMetadata() {
  const { url, policy } = seo.policyFor({
    kind: "product",
    locale: "ar",
    path: "/robe",
    searchParams: { page: "2" },
    env: process.env,
  });
  const context = seo.mapLocaleContext("ar", process.env);
  return seo.buildMetadata({
    content: seo.copyContent(context, {
      kind: "product",
      entityKey: "robe",
      publicPath: url.pathname,
      title: "Robe",
      description: "A cotton robe",
    }),
    policy,
    origin: seo.originFor(process.env) ?? "",
    url,
    productOffer: { amount: 12.5, currency: "KWD" },
  });
}
```

`productOffer: null` still marks the page as a product, so `og:type` is not `website`. Next.js metadata cannot emit `product:price:*`. Render those tags in the page:

```tsx
import { ProductOpenGraph } from "@ramezjamal/seo-module";

<ProductOpenGraph price={{ amount: 12.5, currency: "KWD" }} />
```

JSON-LD:

```tsx
import { JsonLdScript } from "@ramezjamal/seo-module";

const data = seo.buildProductJsonLd({
  origin,
  locale: "ar",
  product: {
    id: "1",
    slug: seo.productJsonLdSlug("robe-blue", "robe"),
    title: "Robe",
    price: { amount: 12.5, currency: "KWD" },
    stockStatus: "in_stock",
  },
});

<JsonLdScript data={data} />
```

A configurable parent (`isParent: true`) does not receive an Offer. Two or more valid seller prices in one currency become an AggregateOffer.

### robots.txt and sitemap

Route handlers stay in the app. Turbopack production builds omit dotted `app` folders, so `/robots.txt` and `/sitemap.xml` are usually rewrites to normal routes.

```ts
export function GET() {
  return new Response(seo.buildRobotsTxt(process.env), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
```

While indexing is off, `buildRobotsTxt` is `Disallow: /` and `documentRobotsHeader()` is `noindex`. `shouldAttachDocumentRobotsHeader` is false for `/_next`, `/api`, and static assets.

```ts
const entries = products.flatMap((product) => {
  const entry = seo.selectSitemapEntry({
    origin,
    locale: "ar",
    path: `/${product.slug}`,
    kind: "product",
    group: "products",
    lastmod: product.updatedAt,
  });
  return entry ? [entry] : [];
});

if (seo.shouldPublishSitemap(process.env)) {
  const publication = seo.publishSitemap(origin, entries);
  // publication.kind is "index"; write publication.xml and publication.files
}
```

`publishSitemap` throws when every entry was filtered out. Split files stay at or under 50,000 URLs and 50 MB unless you pass other limits.

### Titles and images

```ts
seo.composeTitle(metaTitle, name, "Example");
seo.composeDescription(metaDescription, shortText, bodyText);
seo.ignoredCanonical(sourceCanonical); // recorded, never used as the public URL
seo.resolveSharingImage({ candidates, alt: title }, process.env);
```

Sharing images must be `https`, on `SEO_MEDIA_ORIGINS` or `mediaOrigins`, and must not carry a signed query. Missing width or height is left missing.

## Scripts

```bash
npm test
npm run build
```

## Publish

Do this from a machine that can push packages to `ramezjamal/seo-module`. Do not commit a token.

```bash
npm whoami --registry=https://npm.pkg.github.com
npm run build
npm test
npm publish
```

`prepublishOnly` runs the build and the tests. The GitHub token needs `write:packages`. The package is `restricted`.

## What stays in each app

Data loading, page `generateMetadata`, route handlers, `next.config` rewrites, cache storage, and the 503 HTML document stay in the app. See [EXTRACTION.md](./EXTRACTION.md) for behavior that was not copied because the source was incomplete or belonged to one storefront.
