import { readFileSync } from 'node:fs';
import { buildShoppingList, textFor } from '../src/lib/ingredients';
import { redmartMatch } from '../src/data/redmart';
import type { Recipe } from '../src/lib/types';
const d = JSON.parse(readFileSync(new URL('../src/data/seed.json', import.meta.url), 'utf8')) as { recipes: Recipe[] };
for (const lang of ['fr', 'en'] as const) {
  const lines = buildShoppingList(d.recipes.filter((r) => !r.deleted).map((r) => ({ recipe: r, ratio: 1, title: textFor(r, lang).title })), lang);
  const hit = lines.filter((l) => redmartMatch(`${l.label} ${l.key}`));
  console.log(`## ${lang}: ${hit.length}/${lines.length} matched`);
  console.log(hit.map((l) => `${l.label} → ${redmartMatch(`${l.label} ${l.key}`)!.n.split(' ').slice(0, 4).join(' ')}`).join('\n'));
}
