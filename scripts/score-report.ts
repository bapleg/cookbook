import { readFileSync } from 'node:fs';
import { scoreRecipe, KIDS_PROFILE, type HealthProfile } from '../src/lib/health';
import type { Recipe } from '../src/lib/types';
const d = JSON.parse(readFileSync(new URL('../src/data/seed.json', import.meta.url), 'utf8')) as { recipes: Recipe[] };
const extra = process.argv[2] ? (await import(process.argv[2])) : {};
const profiles: HealthProfile[] = [extra.bap, extra.leah, KIDS_PROFILE].filter(Boolean);
(globalThis as any).localStorage = { getItem: () => null };
for (const r of d.recipes.slice(0, 54)) {
  const row = profiles.map((p) => { const s = scoreRecipe(r, p, 'fr'); return s ? `${p.id}:${s.value}` : `${p.id}:—`; }).join(' ');
  console.log((r.fr || r.en)!.title.slice(0, 34).padEnd(34), row);
}
