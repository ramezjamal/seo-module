# Extraction notes

The package follows the Beatykw `src/seo` engine identified in the SEO package analysis. Shop hosts, brand assets, Magento field names, and Typesense collection walks are not defaults.

These pieces were not copied because the source body was missing from the captured reads, or because the audit said they stay in the app.

## Not included

- **FAQPage and ItemList JSON-LD.** `buildFaqPageJsonLd` and `buildItemListJsonLd` exist in `structured-data.ts`. The captured read includes the FAQ loop start (`plainText` on question and answer) and then stops. The ItemList function body was in the unread line range. Inventing the schema fields would not match the file.
- **HTML tag walker.** `text.ts` captured the named-entity table and the list of tags that introduce space. `extractText`, `readTag`, `skipUntilClose`, and `decodeEntitiesOnce` were not captured. `plainText` decodes that entity table and removes `<...>` spans. It is not the original walker.
- **`product-json-ld-offer.ts`.** The file is 42 lines and was not captured. Offer rules in this package are the ones in `structured-data.ts`: a parent product has no Offer, a negative or non-finite amount is dropped, and a missing stock status drops the Offer. A later note in the storefront asked for `amount > 0`, `amount < 9999999`, and offers on parents when a schema price exists. That file was not available, so those rules are not implemented.
- **Cache planners in the middle of `cache-policy.ts`.** `publicFetchCachePlan`, `decideCachedPublication`, `sitemapCountDropped`, and `planRevalidation` (about lines 71–159) were not captured. `publicCacheKey` and the revalidation-slot return were captured. The slot's window filter is the logic required by that return: the oldest hit still inside 60 seconds. Sitemap tag matching uses prefixes you pass. The reference prefixes (`magento:product:`, `magento:products:`, `magento:category:`, `categories:`, and the home content-page pattern) are not built in.
- **`isMissingUpdatedAtField`.** The audit said to leave this Typesense schema check out.
- **Magento, Typesense, and route handlers.** `adapters/magento.ts`, `sitemap-catalog.ts`, `sitemap-store.ts`, `search-listing.ts`, `catalog-http.ts`, `dedicated-http.ts`, `serve-unavailable.ts`, `unavailable-document.ts`, `launch-preview.ts` response bodies, and `src/app/api/seo/**` stay in the app. `unstable_cache` stays in the app.
- **`cms-locale-switch.ts`, `availability.ts`, `sitemap-publication.ts`, `pagination.ts` bodies.** Signatures and the handover description were available. `isPaginationBeyondResults` follows the handover sentence: a positive integer past `pageCount` is past the results. The other three files are omitted rather than rewritten from the names.
- **`selectImage`, `parseLastModified`, and `withLocale`.** Their bodies were in an unread gap in `adapters/compose.ts`. Title composition, description order, editorial robots trim, ignored canonical trim, and length warnings were captured and are exported.
- **Brand logo fallback.** The reference used a shop logo when `SEO_DEFAULT_OG_IMAGE_URL` was unset. This package returns no brand image until that variable is an allowlisted `https` URL.
- **Default media hosts and blocked shop hosts.** Spaces hosts, `admin` hosts, and the staging preview host are not in the package. Pass `mediaOrigins`, `origins.blockedHosts`, and `origins.stagingOrigins`. `localhost`, `127.0.0.1`, and `example.com` remain blocked because that check is generic.

## Reconstructed from a captured contract

These helpers were called by captured code, and the comment or the three-line body was visible, but the full function text was in an unread range:

- `validPageValue` — the body `/^[1-9]\d*$/` was captured.
- `stripLegacyCatalogPrefix` — one leading segment from `paths.legacyPrefixes`, matching the path builder comment.
- `decodeSegmentOnce` — decode once; leave a segment unchanged when it has no `%` or the escape is invalid.
- `readParams` / `hasInvalidPageQuery` — read `URLSearchParams` or a record in input order; `page` is invalid when any value fails `validPageValue`.
- `resolveAlternates` — the comment says missing counterparts are omitted, the current slug is not copied, the homepage is not substituted, and `x-default` is not added.
- `presentText`, the end of `composeDescription`, and `containsBrand` — the same trim and `includes` rules as the captured title and canonical helpers.
- `hreflang` language map — the captured function required the locale to be `ar` and an alternate to be both `ar` and not the current locale, which cannot succeed. The package emits hreflang only for public locales, only when another public counterpart exists, and then drops `retiredHreflang` tags and non-public locale paths. Page 2 and later still omit the language map.
- `indexVariantParents` — same JSON `variants` walk, but the child property name is an argument. The reference passed `url_key`.

## Page-kind table

The reference `switch` on `PageKind` is not the default. Pass `policies`. Query modifiers still match the captured function: facet, sort, listing control, and preview become noindex, follow, with the canonical omitted. An invalid `page` is HTTP 404 before that table. The indexing gate can turn index off. It does not turn follow back on.
