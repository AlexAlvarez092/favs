# AGENTS.md — Complete Technical Specification

This is the authoritative technical document for the favs project.
It contains all decisions, constraints, architecture, data models, implementation phases,
and verification steps needed to build the site.

Use this document to understand what to build and how.

## Executive Summary

**favs** is a static website published on GitHub Pages that displays, searches, and filters favorite links.
The site is read-only in its first version, with no public editing workflow.
Data lives in a static JSON file in the repository.
Favicons and auto-derived descriptions are enriched before build, not at runtime.
The stack is Astro + TypeScript + GitHub Actions.

## Technical Stack Decision

- **Framework:** Astro (static site generation, GitHub Pages compatible)
- **Language:** TypeScript (for data safety and developer experience)
- **Data Storage:** Static JSON file in the repository
- **Data Enrichment:** Node.js script that fetches metadata before the Astro build
- **Styling:** CSS or Tailwind CSS (keep dependencies minimal; Astro's native CSS support is sufficient)
- **Deployment:** GitHub Actions workflow that builds and deploys to GitHub Pages

### Why This Stack

- Astro generates pure static HTML with minimal JavaScript, ideal for GitHub Pages.
- TypeScript prevents runtime errors and makes the data model self-documenting.
- A Node.js enrichment script keeps metadata fetching out of the browser and free from CORS limits.
- GitHub Actions is native to GitHub and needs no external infrastructure.
- This combination is maintainable even after the initial developer hands off.

## Key Constraints And Decisions

1. **No CORS for metadata fetching at runtime:** Browsers cannot reliably fetch metadata from arbitrary third-party sites.
   Therefore, automatic favicon and description extraction must happen before build in a Node.js script.

2. **Static data only:** GitHub Pages does not host databases or custom backends.
   All runtime data must be JSON serialized into the HTML or pre-loaded client-side.

3. **Client-side search and filtering:** Search runs in the browser; no backend queries needed.
   This is fine for the expected dataset size.

4. **No public add/remove workflow:** Initial version focuses on read-only browsing.
   Future editing workflows are deferred.

5. **Responsive mobile-first design:** The UI must work on laptop, tablet, and mobile without breakage.

## Directory Structure

The project should follow this structure once scaffolded:

```text
.
├── README.md
├── AGENTS.md
├── .gitignore
├── package.json
├── tsconfig.json
├── astro.config.mjs
├── src/
│   ├── data/
│   │   ├── schema.ts
│   │   ├── favoritesRaw.json
│   │   └── favorites.json (generated after enrichment)
│   ├── scripts/
│   │   └── enrichFavorites.ts
│   ├── components/
│   │   ├── FavoriteCard.astro
│   │   ├── SearchBox.astro
│   │   ├── TagFilter.astro
│   │   └── FavoritesList.astro
│   ├── pages/
│   │   └── index.astro
│   ├── layouts/
│   │   └── BaseLayout.astro
│   └── styles/
│       ├── global.css
│       └── components.css
├── public/
│   └── (static assets, if any)
├── .github/
│   └── workflows/
│       └── deploy.yml (GitHub Actions workflow)
└── .prettierrc (optional, for code formatting)
```

## Data Model

The source of truth is a static JSON file containing an array of favorites.

### Schema Definition (TypeScript)

```typescript
interface Favorite {
    id: string; // Unique identifier, lowercase hyphenated
    url: string; // Target URL (must be valid HTTP/HTTPS)
    title: string; // Display name (optional if derived from metadata, but recommended)
    description: string; // Manual or auto-derived
    tags: string[]; // Lowercase, no duplicates
    favicon: string | null; // URL to favicon, or null if unavailable
}

interface FavoritesData {
    version: string; // Semantic version for schema tracking
    lastUpdated: string; // ISO 8601 timestamp
    favorites: Favorite[];
}
```

### Example Data (favoritesRaw.json)

```json
{
    "version": "1.0.0",
    "lastUpdated": "2026-04-16T00:00:00Z",
    "favorites": [
        {
            "id": "github",
            "url": "https://github.com",
            "title": "GitHub",
            "description": "Code hosting and collaboration platform.",
            "tags": ["development", "git", "tools"],
            "favicon": null
        },
        {
            "id": "astro-docs",
            "url": "https://docs.astro.build",
            "title": "Astro Documentation",
            "description": "",
            "tags": ["development", "documentation", "web"],
            "favicon": null
        }
    ]
}
```

### After Enrichment (favorites.json)

The enrichment script should populate missing favicons and descriptions, writing the result as `src/data/favorites.json`.
This enriched file is what Astro reads and renders.

## Search Behavior Specification

- Search input: single text field, updates in real-time as user types
- Match logic: case-insensitive substring match on URL and description
- Results update immediately without page reload
- Search and tag filters stack: results must match both constraints

Example:

- User types "github" → shows only favorites with "github" in URL or description
- User clicks tag "development" → further narrows to development-related items
- User clears search → shows all development-tagged items

## Important Assumptions And Fallbacks

1. **Missing Favicon:** Use a default icon or leave empty. Do not crash the build.
2. **Missing Description:** Show empty string or a placeholder. Do not crash the build.
3. **Invalid URL:** The enrichment script should validate URLs before fetching. Log warnings for invalid URLs.
4. **CORS or Network Errors:** If metadata fetch fails, proceed without enrichment. Data is still valid.
5. **Duplicate IDs:** The enrichment script should detect and warn about duplicate IDs; the build should fail if duplicates are found.

## npm Scripts Summary

Expected scripts in `package.json`:

```json
{
    "scripts": {
        "dev": "astro dev",
        "build": "npm run enrich && astro build",
        "enrich": "node --loader ts-node/esm src/scripts/enrichFavorites.ts",
        "preview": "astro preview",
        "check": "astro check"
    }
}
```

## Testing Checklist For Implementation

- [ ] All favorites render without errors
- [ ] Search filters by URL correctly
- [ ] Search filters by description correctly
- [ ] Tag filters work independently
- [ ] Search and tag filters work together
- [ ] Layout is responsive at 375px, 768px, 1024px
- [ ] Missing favicons display gracefully
- [ ] No JavaScript console errors
- [ ] Build completes without warnings
- [ ] GitHub Pages deployment succeeds
- [ ] Site is live and browsable

## Important Implementation Rules

1. **Do not hardcode data in components.** Always read from `src/data/favorites.json`.
2. **Do not fetch metadata at runtime in the browser.** The enrichment script must run before build.
3. **Do not assume GitHub Pages will host a backend.** Keep everything static.
4. **Always validate the data schema.** Catch data issues early.
5. **Keep the site lightweight.** Minimize JavaScript and dependencies.
6. **Test on real mobile devices or browser dev tools.** Responsive design matters.

## Skills

The folder `.agents/` contains detailed documentation on the skills needed to implement this project, review all of them to understand the technical requirements and best practices for each part of the implementation. Do not implement any part of the project without first reviewing the relevant skills documentation.

## Future Extension Points (Out Of Scope For Now)

- Public form to suggest new favorites (would need backend service)
- User accounts and personal collections (would need authentication)
- Dark mode toggle (low priority for read-only site)
- Analytics or usage tracking (not necessary for GitHub Pages)
- API endpoint to export favorites (possible, but not core to MVP)

## References

- Astro Documentation: https://docs.astro.build
- GitHub Pages: https://pages.github.com
- TypeScript: https://www.typescriptlang.org
