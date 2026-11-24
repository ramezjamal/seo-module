import { isApprovedProductionOrigin } from "./config.js";
import { plainText } from "./content.js";
import type { NormalizedSeoOptions } from "./options.js";
import type { JsonValue, StockStatus } from "./types.js";
import { absoluteUrl, buildStorefrontPath } from "./url.js";

export type { JsonValue };

export type BreadcrumbSchemaItem = {
  name: string;
  /** Locale-free path such as `/` or `/air-conditioners`. Omit for the current page when it has no link. */
  path?: string | null;
};

export type SellerOfferSchemaInput = {
  price?: { amount?: number | null; currency?: string | null } | null;
  seller?: { name?: string | null } | null;
  /** Storefront slug of that seller's listing. Falls back to the product URL. */
  productSlug?: string | null;
};

export type ProductSchemaInput = {
  id: string;
  slug: string;
  title: string;
  sku?: string | null;
  description?: string | null;
  brandName?: string | null;
  images?: ReadonlyArray<{ src?: string | null; alt?: string | null }>;
  price?: { amount: number; currency: string } | null;
  stockStatus?: StockStatus | null;
  sellerName?: string | null;
  /** Product-level rating only. Never pass a seller rating here. */
  rating?: number | null;
  reviewCount?: number | null;
  /** Configurable parent that is not itself the purchasable offer. */
  isParent?: boolean;
  /**
   * Marketplace offers for this product. Two or more valid entries in one
   * currency produce an AggregateOffer. Nothing is invented for a missing
   * seller, price, currency, or availability.
   */
  sellerOffers?: ReadonlyArray<SellerOfferSchemaInput> | null;
};

export type OrganizationSchemaInput = {
  name: string;
  url: string;
  email?: string | null;
  telephone?: string | null;
  logoUrl?: string | null;
  sameAs?: readonly (string | null | undefined)[];
};

/**
 * Serialize JSON-LD for a script tag. Escapes `<` and line/paragraph separators
 * so product text cannot close the script element.
 */
export function serializeJsonLd(value: JsonValue): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("JSON-LD payload is not serializable.");
  }
  return serialized
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildProductJsonLd(
  input: {
    origin: string;
    locale: string;
    product: ProductSchemaInput;
    fallbackDescription?: string;
  },
  options: NormalizedSeoOptions,
): JsonValue | null {
  if (!isApprovedProductionOrigin(input.origin, options)) return null;
  const path = buildStorefrontPath(input.locale, input.product.slug, options).pathname;
  const productUrl = absoluteUrl(input.origin, path);
  const description =
    plainText(input.product.description) || plainText(input.fallbackDescription) || undefined;
  const images = (input.product.images ?? [])
    .map((image) => image.src?.trim())
    .filter((src): src is string => Boolean(src));
  const brandName = input.product.brandName?.trim();
  const sku = input.product.sku?.trim();

  const data: { [key: string]: JsonValue } = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: input.product.title,
    url: productUrl,
  };

  if (description) data.description = description;
  if (sku) data.sku = sku;
  if (images.length > 0) data.image = images;
  if (brandName) {
    data.brand = { "@type": "Brand", name: brandName };
  }

  const aggregate = input.product.isParent
    ? undefined
    : buildAggregateOfferJsonLd(
        {
          origin: input.origin,
          locale: input.locale,
          productUrl,
          sellerOffers: input.product.sellerOffers,
        },
        options,
      );
  const offer =
    aggregate ??
    buildOfferJsonLd({
      productUrl,
      price: input.product.price,
      stockStatus: input.product.stockStatus,
      sellerName: input.product.sellerName,
      isParent: input.product.isParent,
    });
  if (offer) data.offers = offer;

  const rating = buildAggregateRating(input.product.rating, input.product.reviewCount);
  if (rating) data.aggregateRating = rating;

  return data;
}

export function buildBreadcrumbListJsonLd(
  input: {
    origin: string;
    locale: string;
    items: readonly BreadcrumbSchemaItem[];
    /** Absolute or locale-prefixed path for the current page when the last crumb has no href. */
    currentPath?: string | null;
  },
  options: NormalizedSeoOptions,
): JsonValue | null {
  const crumbs = input.items
    .map((item) => ({
      name: item.name.replace(/\s+/g, " ").trim(),
      path: item.path,
    }))
    .filter((item) => item.name.length > 0);
  if (!isApprovedProductionOrigin(input.origin, options)) return null;
  if (crumbs.length === 0) return null;

  const elements: JsonValue[] = [];
  for (let index = 0; index < crumbs.length; index += 1) {
    const crumb = crumbs[index]!;
    const isLast = index === crumbs.length - 1;
    const path = crumb.path ?? (isLast ? input.currentPath : null);
    if (!path && !isLast) continue;
    const item: { [key: string]: JsonValue } = {
      "@type": "ListItem",
      position: elements.length + 1,
      name: crumb.name,
    };
    if (path) {
      const pathname = buildStorefrontPath(input.locale, path, options).pathname;
      item.item = absoluteUrl(input.origin, pathname);
    }
    elements.push(item);
  }

  if (elements.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: elements,
  };
}

export function buildOrganizationJsonLd(
  input: OrganizationSchemaInput,
  options: NormalizedSeoOptions,
): JsonValue | null {
  const name = input.name.trim();
  const url = normalizePublicUrl(input.url);
  if (!name || !url || !isApprovedProductionOrigin(url, options)) return null;

  const data: { [key: string]: JsonValue } = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${url}#organization`,
    name,
    url,
  };

  const email = input.email?.trim();
  if (email && email.includes("@")) data.email = email;

  const telephone = input.telephone?.trim();
  if (telephone) data.telephone = telephone;

  const logo = normalizePublicUrl(input.logoUrl ?? undefined);
  if (logo) {
    data.logo = { "@type": "ImageObject", url: logo };
  }

  const sameAs = (input.sameAs ?? [])
    .map((entry) => normalizeProfileUrl(entry))
    .filter((entry): entry is string => Boolean(entry));
  if (sameAs.length > 0) data.sameAs = sameAs;

  return data;
}

export function buildWebSiteJsonLd(
  input: {
    name: string;
    origin: string;
    locale: string;
  },
  options: NormalizedSeoOptions,
): JsonValue | null {
  const name = input.name.trim();
  const origin = normalizePublicUrl(input.origin);
  if (!name || !origin || !isApprovedProductionOrigin(origin, options)) return null;

  let homepage: string;
  try {
    homepage = absoluteUrl(origin, buildStorefrontPath(input.locale, "/", options).pathname);
  } catch {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}#website`,
    name,
    url: homepage,
    inLanguage: input.locale,
    publisher: { "@id": `${origin}#organization` },
  };
}

function buildOfferJsonLd(input: {
  productUrl: string;
  price?: { amount: number; currency: string } | null;
  stockStatus?: StockStatus | null;
  sellerName?: string | null;
  isParent?: boolean;
}): JsonValue | undefined {
  if (input.isParent) return undefined;
  const amount = input.price?.amount;
  const currency = input.price?.currency?.trim();
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || !currency) {
    return undefined;
  }
  if (!input.stockStatus) return undefined;

  const availability = availabilityUrl(input.stockStatus);
  if (!availability) return undefined;

  const offer: { [key: string]: JsonValue } = {
    "@type": "Offer",
    url: input.productUrl,
    price: amount,
    priceCurrency: currency,
    availability,
  };

  const sellerName = input.sellerName?.trim();
  if (sellerName) {
    offer.seller = {
      "@type": "Organization",
      name: sellerName,
    };
  }

  return offer;
}

type ValidSellerOffer = {
  amount: number;
  currency: string;
  sellerName?: string;
  url: string;
};

/**
 * AggregateOffer from two or more valid marketplace offers in one currency.
 * Returns undefined for fewer valid offers or mixed currencies so the caller
 * keeps the single-Offer rule. Availability is not on the seller-offer data,
 * so the nested Offers do not declare it.
 */
function buildAggregateOfferJsonLd(
  input: {
    origin: string;
    locale: string;
    productUrl: string;
    sellerOffers?: ReadonlyArray<SellerOfferSchemaInput> | null;
  },
  options: NormalizedSeoOptions,
): JsonValue | undefined {
  const valid: ValidSellerOffer[] = [];
  for (const offer of input.sellerOffers ?? []) {
    const amount = offer?.price?.amount;
    const currency = offer?.price?.currency?.trim();
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || !currency) {
      continue;
    }
    const sellerName = offer.seller?.name?.trim() || undefined;
    const slug = offer.productSlug?.trim();
    let url = input.productUrl;
    if (slug) {
      try {
        url = absoluteUrl(
          input.origin,
          buildStorefrontPath(input.locale, slug, options).pathname,
        );
      } catch {
        url = input.productUrl;
      }
    }
    valid.push({ amount, currency, ...(sellerName ? { sellerName } : {}), url });
  }
  if (valid.length < 2) return undefined;

  const currency = valid[0]!.currency;
  if (valid.some((offer) => offer.currency !== currency)) return undefined;

  const amounts = valid.map((offer) => offer.amount);
  return {
    "@type": "AggregateOffer",
    priceCurrency: currency,
    lowPrice: Math.min(...amounts),
    highPrice: Math.max(...amounts),
    offerCount: valid.length,
    offers: valid.map((offer) => {
      const entry: { [key: string]: JsonValue } = {
        "@type": "Offer",
        url: offer.url,
        price: offer.amount,
        priceCurrency: offer.currency,
      };
      if (offer.sellerName) {
        entry.seller = { "@type": "Organization", name: offer.sellerName };
      }
      return entry;
    }),
  };
}

function buildAggregateRating(
  rating: number | null | undefined,
  reviewCount: number | null | undefined,
): JsonValue | undefined {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return undefined;
  if (rating < 0 || rating > 5) return undefined;
  if (typeof reviewCount !== "number" || !Number.isInteger(reviewCount) || reviewCount <= 0) {
    return undefined;
  }
  return {
    "@type": "AggregateRating",
    ratingValue: rating,
    reviewCount,
    worstRating: 1,
    bestRating: 5,
  };
}

function availabilityUrl(status: StockStatus): string | undefined {
  switch (status) {
    case "in_stock":
    case "low_stock":
      return "https://schema.org/InStock";
    case "backorder":
      return "https://schema.org/BackOrder";
    case "out_of_stock":
      return "https://schema.org/OutOfStock";
    default:
      return undefined;
  }
}

function normalizePublicUrl(value: string | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Reject bare platform roots such as `https://x.com` with no profile path. */
function normalizeProfileUrl(value: string | null | undefined): string | null {
  const url = normalizePublicUrl(value ?? undefined);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.pathname === "/" || parsed.pathname === "") return null;
    return url;
  } catch {
    return null;
  }
}
