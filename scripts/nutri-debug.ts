import { readFileSync } from 'node:fs';
import { nutritionOf } from '../src/lib/nutrition';
import type { Recipe } from '../src/lib/types';
const d = JSON.parse(readFileSync(new URL('../src/data/seed.json', import.meta.url), 'utf8')) as { recipes: Recipe[] };
const ids = process.argv.slice(2).map(Number);
for (const r of d.recipes.filter((x) => ids.includes(x.id))) {
  const n = nutritionOf(r)!; console.log('##', r.fr!.title, 'serv', r.servings);
  for (const f of n.foods) console.log('  ', Math.round(f.grams), 'g |', f.food, '|', f.line.slice(0,60));
}
