// One-off: run every recipe in the seed through the same clean-up rules the app applies on save.
import { readFileSync, writeFileSync } from 'node:fs';
import { normaliseText } from '../src/lib/normalise';
import type { Recipe, Lang } from '../src/lib/types';

const path = new URL('../src/data/seed.json', import.meta.url);
const d = JSON.parse(readFileSync(path, 'utf8')) as { recipes: Recipe[] };
const changes: string[] = [];
for (const r of d.recipes) {
  for (const l of ['fr', 'en'] as Lang[]) {
    const t = r[l];
    if (!t || !t.title) continue;
    const n = normaliseText(t, l);
    t.ingredients.forEach((x, i) => { if (x.replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim() !== n.ingredients[i]) changes.push(`${r.id} ${l} ING  ${x.trim()}  →  ${n.ingredients[i]}`); });
    if (n.title !== t.title) changes.push(`${r.id} ${l} TITLE ${t.title} → ${n.title}`);
    const a = t.directions.split('\n'), b = n.directions.split('\n');
    a.forEach((x, i) => { const y = b[i]; if (y && x.replace(/[​ ]/g, ' ').trim() !== y) changes.push(`${r.id} ${l} STEP ${x.trim().slice(0, 90)} → ${y.slice(0, 90)}`); });
    r[l] = n;
  }
}
if (process.argv.includes('--write')) writeFileSync(path, JSON.stringify(d));
console.log(changes.join('\n'));
console.error(changes.length + ' changes');
