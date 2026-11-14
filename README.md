# Family Cookbook v2

Recettes, menu de la semaine et liste de courses de la famille — https://bapleg.github.io/cookbook/

- **App**: Vite + React + TypeScript, installable PWA (works offline). Source in `src/`, deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.
- **Relay**: Cloudflare Worker in `worker/` (auto-deployed by Cloudflare Workers Builds on push). It stores the shared data in a private GitHub gist (`recipes.json`, `ratings.json`, `plan.json`, `shopping.json`) so no token ever reaches the browser, fetches recipe pages for "import from a link", and runs Workers AI to translate/standardise imported recipes.
  - Secret `GIST_TOKEN` (GitHub token, `gist` scope) — set in Cloudflare → Worker → Settings.
  - Optional secret `WRITE_KEY` — when set, writes require it (for adding a password later).
- **Data rules** (`src/lib/normalise.ts`): metric only, British English, one canonical name per ingredient so the shopping list merges across recipes.

```bash
npm install
npm run dev        # local dev (set VITE_RELAY_URL to use the live relay)
npm run build
```
