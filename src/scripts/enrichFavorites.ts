import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

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

const TITLE_TAG_REGEX = /<title[^>]*>([\s\S]*?)<\/title>/i;
const META_REFRESH_REGEX =
    /<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"';]+)[^"']*["'][^>]*>/i;
const ICON_REGEX =
    /<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i;

const NAMED_HTML_ENTITIES: Record<string, string> = {
    amp: "&",
    apos: "'",
    quot: '"',
    lt: "<",
    gt: ">",
    nbsp: " ",
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
    ndash: "-",
    mdash: "-",
    hellip: "...",
    copy: "(c)",
    reg: "(r)",
    trade: "TM",
};

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(value: string): string {
    return value.replace(
        /&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi,
        (match, entity) => {
            if (!entity) {
                return match;
            }

            if (entity[0] === "#") {
                const isHex = entity[1]?.toLowerCase() === "x";
                const rawCodePoint = isHex ? entity.slice(2) : entity.slice(1);
                const codePoint = Number.parseInt(
                    rawCodePoint,
                    isHex ? 16 : 10,
                );

                if (!Number.isFinite(codePoint)) {
                    return match;
                }

                try {
                    return String.fromCodePoint(codePoint);
                } catch {
                    return match;
                }
            }

            const normalizedEntity = entity.toLowerCase();
            return NAMED_HTML_ENTITIES[normalizedEntity] ?? match;
        },
    );
}

function generateId(url: string): string {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.replace(/^www\./, "");
        const slug = hostname
            .split(".")[0]
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-");

        // Create a hash from the full URL to ensure uniqueness
        const hash = crypto
            .createHash("md5")
            .update(url)
            .digest("hex")
            .slice(0, 8);

        return slug ? `${slug}-${hash}` : `favorite-${hash}`;
    } catch {
        const hash = crypto
            .createHash("md5")
            .update(url)
            .digest("hex")
            .slice(0, 10);
        return `favorite-${hash}`;
    }
}

function extractMetaContent(
    html: string,
    key: string,
    keyAttr: "name" | "property",
): string | null {
    const escapedKey = escapeRegExp(key);
    const primaryPattern = new RegExp(
        `<meta\\b[^>]*\\b${keyAttr}\\s*=\\s*["']${escapedKey}["'][^>]*\\bcontent\\s*=\\s*["']([^"']*)["'][^>]*>`,
        "i",
    );
    const alternatePattern = new RegExp(
        `<meta\\b[^>]*\\bcontent\\s*=\\s*["']([^"']*)["'][^>]*\\b${keyAttr}\\s*=\\s*["']${escapedKey}["'][^>]*>`,
        "i",
    );

    return (
        html.match(primaryPattern)?.[1]?.trim() ||
        html.match(alternatePattern)?.[1]?.trim() ||
        null
    );
}

function resolveIconUrl(
    siteUrl: string,
    iconHref: string | null,
): string | null {
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

    const html = await response.text();
    const refreshUrl = html.match(META_REFRESH_REGEX)?.[1]?.trim();

    if (refreshUrl) {
        const redirectedUrl = new URL(refreshUrl, siteUrl).toString();
        const redirectedResponse = await fetch(redirectedUrl, {
            headers: {
                "user-agent": "favs-enricher/1.0",
            },
        });

        if (redirectedResponse.ok) {
            return redirectedResponse.text();
        }
    }

    return html;
}

function extractDescription(html: string): string | null {
    return (
        extractMetaContent(html, "description", "name") ??
        extractMetaContent(html, "og:description", "property")
    );
}

function extractTitle(html: string): string | null {
    const title =
        (extractMetaContent(html, "og:title", "property") ??
            html.match(TITLE_TAG_REGEX)?.[1]?.trim()) ||
        null;
    return title ? title.split("|")[0].trim() : null;
}

function extractIconHref(html: string): string | null {
    return html.match(ICON_REGEX)?.[1]?.trim() || null;
}

async function enrichFavorite(favorite: Favorite): Promise<Favorite> {
    let id = favorite.id?.trim() || "";
    let title = decodeHtmlEntities(favorite.title?.trim() || "");
    let description = decodeHtmlEntities(favorite.description?.trim() || "");
    let tags = favorite.tags || [];
    let favicon = favorite.favicon;

    if (!id) {
        id = generateId(favorite.url);
    }

    try {
        const html = await fetchHtml(favorite.url);

        if (!title) {
            title = decodeHtmlEntities(extractTitle(html) || "");
        }

        if (!description) {
            description = decodeHtmlEntities(extractDescription(html) || "");
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
        id,
        url: favorite.url,
        title,
        description,
        tags: normalizeTags(tags),
        favicon,
    };
}

async function run(): Promise<void> {
    const raw = await readFile(rawDataPath, "utf8");
    const parsed = JSON.parse(raw) as FavoritesData;

    const favorites = await Promise.all(parsed.favorites.map(enrichFavorite));

    const enriched: FavoritesData = {
        version: parsed.version,
        lastUpdated: new Date().toISOString(),
        favorites,
    };

    const validationErrors = validateFavoritesData(enriched);
    if (validationErrors.length > 0) {
        throw new Error(
            `Data validation failed:\n- ${validationErrors.join("\n- ")}`,
        );
    }

    await writeFile(
        outputDataPath,
        `${JSON.stringify(enriched, null, 2)}\n`,
        "utf8",
    );
    console.info(
        `[enrich] Wrote ${favorites.length} favorites to ${outputDataPath}`,
    );
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
