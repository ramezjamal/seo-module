import { serializeJsonLd } from "./json-ld.js";
import type { JsonValue } from "./types.js";

export function JsonLdScript({ data }: { data: JsonValue | null | undefined }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
