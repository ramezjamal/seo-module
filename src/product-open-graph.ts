export type ProductOpenGraphPrice = {
  amount: number;
  currency: string;
};

export type ProductOpenGraphTag = {
  property: "og:type" | "product:price:amount" | "product:price:currency";
  content: string;
};

/**
 * Product page Open Graph tags.
 * Price and currency come from the displayed offer. Missing money omits the price tags.
 * Next.js `Metadata` does not emit `product:price:*`.
 */
export function productOpenGraphTags(
  price: ProductOpenGraphPrice | null | undefined,
): ProductOpenGraphTag[] {
  const tags: ProductOpenGraphTag[] = [{ property: "og:type", content: "product" }];
  const offer = displayedOffer(price);
  if (!offer) return tags;
  tags.push(
    { property: "product:price:amount", content: offer.amount },
    { property: "product:price:currency", content: offer.currency },
  );
  return tags;
}

function displayedOffer(
  price: ProductOpenGraphPrice | null | undefined,
): { amount: string; currency: string } | null {
  if (!price || !Number.isFinite(price.amount)) return null;
  const currency = price.currency.trim();
  if (!currency) return null;
  return { amount: String(price.amount), currency };
}
