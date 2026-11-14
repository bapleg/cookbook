import { readFileSync } from 'node:fs';
import { nutritionOf } from '../src/lib/nutrition';
import type { Recipe } from '../src/lib/types';
const d = JSON.parse(readFileSync(new URL('../src/data/seed.json', import.meta.url), 'utf8')) as { recipes: Recipe[] };
for (const r of d.recipes) {
  const n = nutritionOf(r);
  const t = (r.fr || r.en)!.title.slice(0, 38).padEnd(38);
  if (!n) { console.log(t, '—'); continue; }
  const p = n.perServing;
  console.log(t, n.nutriScore, `${p.kcal}kcal P${p.protein} F${p.fat}(s${p.satFat}) C${p.carbs} sug${p.sugars} fib${p.fibre} salt${p.salt} Fe${p.iron}`, `fv${n.fvShare}% cov${Math.round(n.coverage*100)}% ${n.gramsPerServing}g`);
}
