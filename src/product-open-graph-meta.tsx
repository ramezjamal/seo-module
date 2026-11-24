import {
  productOpenGraphTags,
  type ProductOpenGraphPrice,
} from "./product-open-graph.js";

export function ProductOpenGraph({
  price,
}: {
  price: ProductOpenGraphPrice | null | undefined;
}) {
  return productOpenGraphTags(price).map((tag) => (
    <meta key={tag.property} property={tag.property} content={tag.content} />
  ));
}
