# favs

[![Deploy To GitHub Pages](https://github.com/AlexAlvarez092/favs/actions/workflows/deploy.yml/badge.svg)](https://github.com/AlexAlvarez092/favs/actions/workflows/deploy.yml)

A personal website for browsing and organizing favorite links across devices and browsers,
published on GitHub Pages.

## Quick Start

- **What is it?** A simple, responsive site to store and discover your favorite links.
- **Where does it live?** On GitHub Pages — no database, no backend needed.
- **Can I add/remove links?** Not yet in version 1. First release is read-only; you manage favorites by editing a JSON file in the repo.

## For Contributors

See the `.agents/` folder for technical documentation including:

- Architecture and design decisions
- Complete implementation specification
- Data model and schema
- Testing guidelines

## Project Structure

```
.
├── README.md           (this file, quick overview)
├── .agents/            (technical documentation and skills)
├── src/
│   ├── data/          (favorites data and schema)
│   ├── scripts/       (enrichment and build scripts)
│   ├── components/    (UI components)
│   ├── pages/         (site pages)
│   └── styles/        (CSS)
├── public/            (static assets)
└── .github/workflows/ (GitHub Actions deployment)
```

## Technologies

- **Astro** for static site generation
- **TypeScript** for type safety
- **GitHub Pages** for hosting
- **GitHub Actions** for CI/CD

## License

See [LICENSE](LICENSE) file in the repository.
