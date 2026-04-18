export interface Favorite {
    id?: string;
    url: string;
    title?: string;
    description?: string;
    tags?: string[];
    favicon?: string | null;
}

export interface FavoritesData {
    version: string;
    lastUpdated: string;
    favorites: Favorite[];
}

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

export function isValidHttpUrl(input: string): boolean {
    try {
        const parsed = new URL(input);
        return HTTP_PROTOCOLS.has(parsed.protocol);
    } catch {
        return false;
    }
}

export function normalizeTags(tags: string[] | undefined): string[] {
    const normalized = (tags || [])
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
    return [...new Set(normalized)];
}

export function validateFavoritesData(data: FavoritesData): string[] {
    const errors: string[] = [];
    const ids = new Set<string>();

    if (!data.version) {
        errors.push("Missing data version.");
    }

    if (!Array.isArray(data.favorites)) {
        errors.push("Favorites must be an array.");
        return errors;
    }

    for (let index = 0; index < data.favorites.length; index++) {
        const favorite = data.favorites[index];

        if (!isValidHttpUrl(favorite.url)) {
            errors.push(`Favorite [${index}] has invalid URL: ${favorite.url}`);
        }

        if (favorite.tags && !Array.isArray(favorite.tags)) {
            errors.push(`Favorite [${index}] tags must be an array.`);
        }

        if (favorite.id) {
            if (ids.has(favorite.id)) {
                errors.push(`Duplicate favorite id: ${favorite.id}`);
            }
            ids.add(favorite.id);
        }
    }

    return errors;
}
