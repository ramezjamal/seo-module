export type SharingImageSource = "custom" | "entity" | "brand";

export type SharingMimeType = "image/jpeg" | "image/png" | "image/webp";

export type SharingImage = {
  url: string;
  alt: string;
  source: SharingImageSource;
  width?: number;
  height?: number;
  mimeType?: SharingMimeType;
};

export type SharingImageCandidate = {
  url?: string | null;
  alt?: string | null;
  role?: SharingImageSource;
  width?: number | null;
  height?: number | null;
};

const SIGNED_QUERY_KEYS = new Set([
  "x-amz-signature",
  "x-amz-algorithm",
  "x-amz-credential",
  "x-amz-security-token",
  "signature",
  "expires",
  "token",
  "sig",
]);

/**
 * Custom OG image, then the entity image, then an approved brand image.
 * Dimensions are copied only when both were supplied. They are never invented.
 */
export function resolveSharingImage(input: {
  candidates: readonly SharingImageCandidate[];
  brand?: SharingImageCandidate | null;
  alt: string;
  mediaOrigins: readonly string[];
  /** Last alt fallback. The reference used the application brand name. */
  brandName?: string;
}): { image?: SharingImage; rejected: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let rejected = false;
  const queue: SharingImageCandidate[] = [
    ...input.candidates.filter((candidate) => (candidate.role ?? "entity") === "custom"),
    ...input.candidates.filter((candidate) => (candidate.role ?? "entity") === "entity"),
    ...(input.brand?.url ? [{ ...input.brand, role: "brand" as const }] : []),
  ];

  for (const candidate of queue) {
    const resolved = acceptCandidate(
      candidate,
      input.alt,
      input.mediaOrigins,
      input.brandName,
    );
    if (resolved.ok === false) {
      if (resolved.reason) {
        rejected = true;
        if (!warnings.includes(resolved.reason)) warnings.push(resolved.reason);
      }
      continue;
    }
    if (!resolved.image.width || !resolved.image.height) {
      warnings.push("sharing-image-dimensions-unknown");
    }
    if (!resolved.image.mimeType) warnings.push("sharing-image-type-unknown");
    return { image: resolved.image, rejected, warnings };
  }

  if (queue.length === 0 || rejected) {
    warnings.push("sharing-image-missing");
  }
  return { rejected, warnings };
}

function acceptCandidate(
  candidate: SharingImageCandidate,
  fallbackAlt: string,
  mediaOrigins: readonly string[],
  brandName?: string,
): { ok: true; image: SharingImage } | { ok: false; reason?: string } {
  const raw = candidate.url?.trim();
  if (!raw) return { ok: false };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "image-origin-rejected" };
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    return { ok: false, reason: "image-origin-rejected" };
  }
  if (!mediaOrigins.includes(parsed.origin)) {
    return { ok: false, reason: "image-origin-rejected" };
  }
  if (hasSignedQuery(parsed)) {
    return { ok: false, reason: "image-signed-url-rejected" };
  }
  parsed.hash = "";
  const size = knownSize(candidate.width, candidate.height);
  const alt =
    cleanAlt(candidate.alt) || cleanAlt(fallbackAlt) || cleanAlt(brandName) || fallbackAlt;
  return {
    ok: true,
    image: {
      url: parsed.toString(),
      alt,
      source: candidate.role ?? "entity",
      ...(size ?? {}),
      ...(mimeFromPath(parsed.pathname)
        ? { mimeType: mimeFromPath(parsed.pathname) }
        : {}),
    },
  };
}

export function hasSignedQuery(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    if (SIGNED_QUERY_KEYS.has(key.toLowerCase())) return true;
  }
  return false;
}

function knownSize(
  width: number | null | undefined,
  height: number | null | undefined,
): { width: number; height: number } | undefined {
  if (!Number.isInteger(width) || !Number.isInteger(height)) return undefined;
  if (!width || !height || width <= 0 || height <= 0) return undefined;
  return { width, height };
}

function mimeFromPath(pathname: string): SharingMimeType | undefined {
  const path = pathname.toLowerCase();
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return undefined;
}

function cleanAlt(value: string | null | undefined): string | undefined {
  const text = value?.replace(/\s+/g, " ").trim();
  return text || undefined;
}
