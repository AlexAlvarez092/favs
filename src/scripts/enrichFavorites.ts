import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizeTags,
  validateFavoritesData,
  type Favorite,
  type FavoritesData,
} from "../data/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");
const rawDataPath = path.join(dataDir, "favoritesRaw.json");
const outputDataPath = path.join(dataDir, "favorites.json");

const META_DESCRIPTION_REGEX = /<meta\\s+name=["']description["']\\s+content=["']([^"']+)["'][^>]*>/i;
const OG_DESCRIPTION_REGEX = /<meta\\s+property=["']og:description["']\\s+content=["']([^"']+)["'][^>]*>/i;
const ICON_REGEX = /<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i;

function resolveIconUrl(siteUrl: string, iconHref: string | null): string | null {
  try {
    if (!iconHref) {
      const parsed = new URL(siteUrl);
      return `${parsed.origin}/favicon.ico`;
    }

    return new URL(iconHref, siteUrl).toString();
  } catch {
    return null;
  }
}

async function fetchHtml(siteUrl: string): Promise<string> {
  const response = await fetch(siteUrl, {
    headers: {
      "user-agent": "favs-enricher/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${siteUrl}: ${response.status}`);
  }

  return response.text();
}

function extractDescription(html: string): string | null {
  const match = html.match(META_DESCRIPTION_REGEX) ?? html.match(OG_DESCRIPTION_REGEX);
  return match?.[1]?.trim() || null;
}

function extractIconHref(html: string): string | null {
  return html.match(ICON_REGEX)?.[1]?.trim() || null;
}

async function enrichFavorite(favorite: Favorite): Promise<Favorite> {
  let description = favorite.description?.trim() || "";
  let favicon = favorite.favicon;

  try {
    const html = await fetchHtml(favorite.url);

    if (!description) {
      description = extractDescription(html) || "";
    }

    if (!favicon) {
      const iconHref = extractIconHref(html);
      favicon = resolveIconUrl(favorite.url, iconHref);
    }
  } catch (error) {
    console.warn(`[enrich] Could not enrich ${favorite.url}:`, error);

    if (!favicon) {
      favicon = resolveIconUrl(favorite.url, null);
    }
  }

  return {
    ...favorite,
    description,
    tags: normalizeTags(favorite.tags),
    favicon,
  };
}

async function run(): Promise<void> {
  const raw = await readFile(rawDataPath, "utf8");
  const parsed = JSON.parse(raw) as FavoritesData;

  const validationErrors = validateFavoritesData(parsed);
  if (validationErrors.length > 0) {
    throw new Error(`Data validation failed:\n- ${validationErrors.join("\n- ")}`);
  }

  const favorites = await Promise.all(parsed.favorites.map(enrichFavorite));

  const enriched: FavoritesData = {
    version: parsed.version,
    lastUpdated: new Date().toISOString(),
    favorites,
  };

  await writeFile(outputDataPath, `${JSON.stringify(enriched, null, 2)}\n`, "utf8");
  console.info(`[enrich] Wrote ${favorites.length} favorites to ${outputDataPath}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
