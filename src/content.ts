import type { SharingImage } from "./images.js";

/** Named entities present in the captured `text.ts` table. */
export const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  hellip: "\u2026",
  mdash: "\u2014",
  ndash: "\u2013",
  laquo: "\u00ab",
  raquo: "\u00bb",
};

/** Editorial warning only. A long title is not cut. */
export const TITLE_WARNING_LENGTH = 70;
export const DESCRIPTION_WARNING_LENGTH = 160;

export type SeoAdaptedContent = {
  kind: string;
  locale: string;
  storeView: string;
  htmlLang: string;
  direction: "ltr" | "rtl";
  hreflang: string;
  ogLocale?: string;
  entityKey: string;
  publicPath: string;
  title: string;
  titleFrom: "meta" | "name";
  brandAppended: boolean;
  titleContainsBrand: boolean;
  description?: string;
  descriptionFrom: "meta" | "short" | "body" | "none";
  keywords?: string;
  ogTitle: string;
  ogDescription?: string;
  ogImage?: SharingImage;
  editorialRobots?: string;
  ignoredSourceCanonical?: string;
  lastModified?: string;
  published: boolean;
  warnings: string[];
};

/**
 * Collapse whitespace and decode the captured named entities.
 * The HTML tag walker (`extractText`, `readTag`, `skipUntilClose`) was not in
 * the captured source, so tags are removed as `<...>` spans and not by that walker.
 */
export function plainText(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const withoutTags = value.replace(/<[^>]*>/g, " ");
  const decoded = withoutTags.replace(/&([a-z]+);/gi, (match, name: string) => {
    return NAMED_ENTITIES[name.toLowerCase()] ?? match;
  });
  const text = decoded.replace(/\s+/g, " ").trim();
  return text || undefined;
}

export function presentText(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

export function composeTitle(
  metaTitle: string | null | undefined,
  name: string | null | undefined,
  brand: string,
): Pick<
  SeoAdaptedContent,
  "title" | "titleFrom" | "brandAppended" | "titleContainsBrand"
> | null {
  const meta = presentText(metaTitle);
  const entity = presentText(name);
  if (meta) {
    return {
      title: meta,
      titleFrom: "meta",
      brandAppended: false,
      titleContainsBrand: containsBrand(meta, brand),
    };
  }
  if (!entity) return null;
  if (!brand || containsBrand(entity, brand)) {
    return {
      title: entity,
      titleFrom: "name",
      brandAppended: false,
      titleContainsBrand: containsBrand(entity, brand),
    };
  }
  return {
    title: `${entity} | ${brand}`,
    titleFrom: "name",
    brandAppended: true,
    titleContainsBrand: true,
  };
}

export function composeDescription(
  metaDescription: string | null | undefined,
  shortText: string | null | undefined,
  bodyText: string | null | undefined,
): Pick<SeoAdaptedContent, "description" | "descriptionFrom"> {
  const meta = presentText(metaDescription);
  if (meta) return { description: meta, descriptionFrom: "meta" };
  const short = presentText(shortText);
  if (short) return { description: short, descriptionFrom: "short" };
  const body = presentText(bodyText);
  if (body) return { description: body, descriptionFrom: "body" };
  return { descriptionFrom: "none" };
}

export function editorialRobots(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

/** A source canonical is recorded by the caller and is not used as the public URL. */
export function ignoredCanonical(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

export function qualityWarnings(title: string, description?: string): string[] {
  const warnings: string[] = [];
  if ([...title].length > TITLE_WARNING_LENGTH) warnings.push("title-length");
  if (description && [...description].length > DESCRIPTION_WARNING_LENGTH) {
    warnings.push("description-length");
  }
  return warnings;
}

function containsBrand(value: string, brand: string): boolean {
  return brand.length > 0 && value.includes(brand);
}
