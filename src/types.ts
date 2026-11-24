/**
 * Shared SEO types. Locales and page kinds are strings supplied by the app.
 * Stock status is defined here so JSON-LD does not import an application type.
 */

export type QueryParamClass =
  | "tracking"
  | "pagination"
  | "sort"
  | "facet"
  | "listing-control"
  | "display"
  | "variant"
  | "preview"
  | "search-identity"
  | "unresolved";

export type ClassifiedParam = {
  name: string;
  value: string;
  class: QueryParamClass;
};

export type RobotsDirective = {
  index: boolean;
  follow: boolean;
  maxImagePreview?: "large";
};

export type CanonicalDecision =
  | { mode: "self" | "consolidate"; url: string }
  | { mode: "omit" };

export type LanguageAlternate = {
  hreflang: string;
  url: string;
};

/** Values read from the captured Product offer switch. */
export type StockStatus = "in_stock" | "low_stock" | "backorder" | "out_of_stock";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
