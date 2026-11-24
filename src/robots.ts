import type { SeoConfig } from "./config.js";

const STATIC_ASSET =
  /\.(?:avif|gif|ico|jpe?g|png|svg|webp|css|js|map|txt|xml|woff2?)$/i;

/**
 * robots.txt that indexing would publish. Does not read or set the indexing flag.
 * Staging preview uses this while `buildRobotsTxt` stays closed.
 */
export function buildLaunchRobotsTxt(config: SeoConfig): string {
  const lines = ["User-agent: *", "Allow: /"];
  if (config.originApproved && config.publicOrigin) {
    lines.push("", `Sitemap: ${config.publicOrigin}/sitemap_index.xml`);
  }
  lines.push("");
  return lines.join("\n");
}

export function buildRobotsTxt(config: SeoConfig): string {
  if (!config.indexingEnabled) {
    return ["User-agent: *", "Disallow: /", ""].join("\n");
  }
  return buildLaunchRobotsTxt(config);
}

/**
 * Document-only header when indexing is off.
 * `noindex` without `nofollow`, so it does not override a page that is `noindex, follow`.
 * Null when indexing is on; page metadata stays the directive.
 */
export function documentRobotsHeader(config: SeoConfig): string | null {
  if (config.indexingEnabled) return null;
  return "noindex";
}

/** False for images, build assets, robots.txt, and sitemap XML. */
export function shouldAttachDocumentRobotsHeader(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return false;
  if (pathname.startsWith("/api/")) return false;
  if (STATIC_ASSET.test(pathname)) return false;
  return true;
}
