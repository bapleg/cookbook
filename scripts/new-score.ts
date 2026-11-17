import { readFileSync } from 'node:fs';
import { scoreRecipe, KIDS_PROFILE } from '../src/lib/health';
import { nutritionOf } from '../src/lib/nutrition';
import { FAMILY_PROFILES } from '../src/lib/familyProfiles';
(globalThis as any).localStorage = { getItem: () => null };
const rs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const r of rs) {
  const n: any = nutritionOf(r);
  console.log('\n' + r.fr.title);
  console.log(' nutri', n?.nutriScore, 'cov', n?.coverage, JSON.stringify(n?.perServing));
  for (const p of [...FAMILY_PROFILES, KIDS_PROFILE]) { const s: any = scoreRecipe(r, p, 'fr'); console.log(' ', p.id, s?.value, JSON.stringify(s).slice(0, 400)); }
}
