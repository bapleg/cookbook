// Family health scores. The generic engine is public; personal profiles (goals, foods to avoid)
// are NEVER bundled: they are imported once on a device from a private link and kept in localStorage.
import type { Recipe, Lang } from './types';
import { nutritionOf, type Nutrition } from './nutrition';

export interface Goals {
  lowSatFat?: boolean;
  highFibre?: boolean;
  omega3?: boolean;
  legumes?: boolean;
  lowSugar?: boolean;
  lowRefined?: boolean;
  iron?: boolean;
  lowSalt?: boolean;
  kids?: boolean;
}
export interface Rule { label: string; re: string }
export interface HealthProfile {
  id: string;
  name: string;
  emoji: string;
  goals: Goals;
  avoid?: Rule[];
  limit?: Rule[];
}
export interface Reason { good: boolean; text: string }
export interface Score { value: number; level: 'great' | 'good' | 'fair' | 'poor'; reasons: Reason[] }

const K = 'cookbook2_health_profiles';

export function loadProfiles(): HealthProfile[] {
  try {
    return JSON.parse(localStorage.getItem(K) || '[]') as HealthProfile[];
  } catch {
    return [];
  }
}
export function saveProfiles(p: HealthProfile[]) {
  localStorage.setItem(K, JSON.stringify(p));
}
export function importProfileFromHash(encoded: string): HealthProfile | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))));
    const p = JSON.parse(json) as HealthProfile;
    if (!p.id || !p.name || !p.goals) return null;
    const list = loadProfiles().filter((x) => x.id !== p.id);
    saveProfiles([...list, p]);
    return p;
  } catch {
    return null;
  }
}

import { FAMILY_PROFILES } from './familyProfiles';

/** Built-in family profiles + any extra ones activated on this device. */
export function allProfiles(): HealthProfile[] {
  const local = loadProfiles();
  return [...FAMILY_PROFILES.filter((p) => !local.some((l) => l.id === p.id)), ...local];
}

export const KIDS_PROFILE: HealthProfile = {
  id: 'kids',
  name: 'Enfants',
  emoji: '🧒',
  goals: { kids: true, lowSalt: true, lowSugar: true, iron: true }
};

function tx(lang: Lang, fr: string, en: string) {
  return lang === 'fr' ? fr : en;
}

function lines(r: Recipe): string[] {
  const t = r.fr?.ingredients?.length ? r.fr : r.en;
  return (t?.ingredients || []).map((l) => l.toLowerCase());
}

const SPICY = /piment(?! doux)|cayenne|chil(l)?i|harissa|sriracha|sambal|jalape|tabasco|scotch bonnet|bird.?s eye|poivre noir en grains|chettinad|wasabi/;
const WHOLE_NUTS = /(amandes?|noisettes?|noix(?! de (?:muscade|coco))|cacahu[eè]tes?|pistaches?|cajou|almonds?|hazelnuts?|walnuts?|peanuts?|cashews?|pistachios?)(?![^,]*(?:poudre|moulue?s?|en poudre|ground|butter|beurre|purée|lait|milk|effilées?|flaked))/;

export function scoreRecipe(r: Recipe, p: HealthProfile, lang: Lang): Score | null {
  const n = nutritionOf(r);
  if (!n) return null;
  const ls = lines(r);
  const reasons: Reason[] = [];
  let v = 60;
  const s = n.perServing;
  const add = (pts: number, good: boolean, text: string) => {
    v += pts;
    reasons.push({ good, text });
  };
  const g = p.goals;

  // general quality from the Nutri-Score
  const ns: Record<string, number> = { A: 10, B: 5, C: 0, D: -8, E: -15 };
  v += ns[n.nutriScore];

  if (g.lowSatFat) {
    if (s.satFat <= 4) add(10, true, tx(lang, `Peu de graisses saturées (${s.satFat} g)`, `Low saturated fat (${s.satFat} g)`));
    else if (s.satFat > 10) add(-12, false, tx(lang, `Beaucoup de graisses saturées (${s.satFat} g)`, `High saturated fat (${s.satFat} g)`));
    else if (s.satFat > 7) add(-6, false, tx(lang, `Graisses saturées assez élevées (${s.satFat} g)`, `Fairly high saturated fat (${s.satFat} g)`));
  }
  if (g.highFibre) {
    if (s.fibre >= 8) add(15, true, tx(lang, `Riche en fibres (${s.fibre} g)`, `High in fibre (${s.fibre} g)`));
    else if (s.fibre >= 5) add(7, true, tx(lang, `Fibres correctes (${s.fibre} g)`, `Decent fibre (${s.fibre} g)`));
    else if (s.fibre < 3) add(-5, false, tx(lang, `Peu de fibres (${s.fibre} g)`, `Low in fibre (${s.fibre} g)`));
  }
  if (g.legumes && n.tags.has('legume')) add(8, true, tx(lang, 'Légumineuses', 'Legumes / pulses'));
  if (g.omega3 && n.tags.has('omega3')) add(10, true, tx(lang, 'Oméga-3 (poisson gras, graines)', 'Omega-3 (oily fish, seeds)'));
  if (g.lowSugar) {
    const lim = g.kids ? 10 : 15;
    if (s.sugars > lim) add(-10, false, tx(lang, `Sucré (${s.sugars} g de sucres)`, `Sugary (${s.sugars} g sugars)`));
  }
  if (g.lowRefined && n.tags.has('refined') && !n.tags.has('wholegrain')) add(-6, false, tx(lang, 'Glucides raffinés (riz blanc, pâtes, farine…)', 'Refined carbs (white rice, pasta, flour…)'));
  if (g.lowSalt) {
    const lim = g.kids ? 1 : 2;
    if (s.salt > lim * 1.5) add(-15, false, tx(lang, `Trop salé (${s.salt} g de sel)`, `Too salty (${s.salt} g salt)`));
    else if (s.salt > lim) add(-7, false, tx(lang, `Assez salé (${s.salt} g de sel)`, `Quite salty (${s.salt} g salt)`));
  }
  if (g.iron) {
    const target = g.kids ? 2.5 : 6;
    if (s.iron >= target) add(15, true, tx(lang, `Riche en fer (${s.iron} mg)`, `Rich in iron (${s.iron} mg)`));
    else if (s.iron >= target * 0.6) add(6, true, tx(lang, `Fer correct (${s.iron} mg)`, `Some iron (${s.iron} mg)`));
    else if (!g.kids) add(-8, false, tx(lang, `Peu de fer (${s.iron} mg)`, `Low in iron (${s.iron} mg)`));
    if (!g.kids) {
      if (n.tags.has('heme')) add(8, true, tx(lang, 'Fer héminique (viande, poisson) : mieux absorbé', 'Haem iron (meat, fish): better absorbed'));
      if (n.tags.has('vitc') && (n.tags.has('legume') || s.iron >= 3)) add(5, true, tx(lang, 'Vitamine C qui aide à absorber le fer', 'Vitamin C helps iron absorption'));
      const dairyG = n.foods.filter((f) => f.tags.includes('dairy')).reduce((a, f) => a + f.grams, 0) / n.servings;
      if (dairyG > 60) add(-6, false, tx(lang, 'Beaucoup de laitages (le calcium freine le fer)', 'Lots of dairy (calcium hinders iron)'));
    }
  }
  if (g.kids) {
    const spicy = ls.filter((l) => SPICY.test(l));
    if (spicy.length) add(-12 * Math.min(spicy.length, 2), false, tx(lang, 'Épicé : réduire le piment pour les petits', 'Spicy: go easy on the chilli for little ones'));
    if (ls.some((l) => WHOLE_NUTS.test(l))) add(-10, false, tx(lang, 'Fruits à coque entiers : à moudre avant 4 ans', 'Whole nuts: grind them for under-4s'));
    if (n.tags.has('alcohol')) add(-5, false, tx(lang, 'Contient de l\'alcool (cuit)', 'Contains alcohol (cooked)'));
    if (n.fvShare >= 35) add(10, true, tx(lang, 'Plein de légumes', 'Lots of veggies'));
    if (s.protein >= 12) add(5, true, tx(lang, 'Bonne source de protéines', 'Good source of protein'));
  }
  const hits = (rules: Rule[] | undefined) =>
    (rules || []).filter((rule) => {
      try {
        const re = new RegExp(rule.re, 'i');
        return ls.some((l) => re.test(l));
      } catch {
        return false;
      }
    });
  const avoid = hits(p.avoid);
  // gentle: the first food to avoid weighs most, the total is capped
  let avoidPts = 0;
  avoid.forEach((rule, i) => {
    const pts = Math.max(-30 - avoidPts, i === 0 ? -12 : -6);
    avoidPts += pts;
    add(pts, false, tx(lang, `Contient : ${rule.label}`, `Contains: ${rule.label}`));
  });
  hits(p.limit).slice(0, 3).forEach((rule) => add(-3, false, tx(lang, `À limiter : ${rule.label}`, `Limit: ${rule.label}`)));
  if (p.avoid?.length && !avoid.length) add(8, true, tx(lang, 'Rien à éviter dans les ingrédients', 'Nothing to avoid in the ingredients'));

  v = Math.max(10, Math.min(100, Math.round(v)));
  const level = v >= 75 ? 'great' : v >= 55 ? 'good' : v >= 35 ? 'fair' : 'poor';
  return { value: v, level, reasons };
}

export const LEVEL_EMOJI: Record<Score['level'], string> = { great: '🟢', good: '🟡', fair: '🟠', poor: '🔴' };

export type { Nutrition };
