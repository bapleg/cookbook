import type { Recipe, SharedData, MealSlot, Ratings, Lang } from './types';
import { totalMinutes, parseServings, dietOf } from './ingredients';

export function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function fromIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  return addDays(x, -dow);
}
export const slotKey = (date: string, slot: MealSlot, recipeId: number) => `${date}|${slot}|${recipeId}`;
export const keyDate = (key: string) => key.split('|')[0];
export const keySlot = (key: string) => (key.split('|')[1] || 'dinner') as MealSlot;

export interface Meal { key: string; id: number; servings: number }

/** All meals planned for a day & slot, oldest first. */
export function mealsOn(data: SharedData, date: string, slot: MealSlot): Meal[] {
  const out: (Meal & { t: number })[] = [];
  for (const [k, e] of Object.entries(data.plan.slots)) {
    if (!e || e.deleted || keyDate(k) !== date || keySlot(k) !== slot) continue;
    const r = data.recipes.find((x) => x.id === e.id);
    if (!r || r.deleted) continue;
    out.push({ key: k, id: e.id, servings: e.servings, t: e.t });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Next day (from today) with no dinner planned; otherwise the first day with only one. */
export function nextFreeDay(data: SharedData, from: Date = new Date(), horizon = 14): string {
  for (const max of [0, 1]) {
    for (let i = 0; i < horizon; i++) {
      const d = iso(addDays(from, i));
      if (mealsOn(data, d, 'dinner').length <= max) return d;
    }
  }
  return iso(from);
}

export function dayLabel(d: Date, lang: Lang): { short: string; num: string; month: string } {
  const loc = lang === 'fr' ? 'fr-FR' : 'en-GB';
  return {
    short: d.toLocaleDateString(loc, { weekday: 'short' }).replace('.', ''),
    num: String(d.getDate()),
    month: d.toLocaleDateString(loc, { month: 'short' }).replace('.', '')
  };
}

export function avgRating(r: Ratings[string] | undefined): number {
  if (!r) return 0;
  const vals = Object.entries(r)
    .filter(([k, v]) => k !== 't' && typeof v === 'number' && v > 0)
    .map(([, v]) => v as number);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

/** Recipes planned in [from, to) -> map recipeId -> last date it was planned. */
export function lastPlanned(data: SharedData): Map<number, string> {
  const m = new Map<number, string>();
  for (const [k, e] of Object.entries(data.plan.slots)) {
    if (!e || e.deleted) continue;
    const date = keyDate(k);
    const cur = m.get(e.id);
    if (!cur || date > cur) m.set(e.id, date);
  }
  return m;
}

export function isComplete(r: Recipe): boolean {
  const t = r.fr || r.en || r.vi;
  return !!t && t.ingredients.filter((x) => x.trim()).length > 0;
}

/**
 * Suggest dinners: favours well-rated, favourites and recipes not eaten recently, keeps variety
 * (no repeat in the window, at most 2 desserts/salads… only mains & salads for dinner), alternates veggie.
 */
export function suggest(
  data: SharedData,
  favs: number[],
  exclude: Set<number>,
  todayIso: string,
  count: number
): Recipe[] {
  const last = lastPlanned(data);
  const pool = data.recipes.filter((r) => !r.deleted && isComplete(r) && (r.category === 'plats' || r.category === 'salades') && !exclude.has(r.id));
  const scored = pool.map((r) => {
    const rating = avgRating(data.ratings[String(r.id)]);
    const lp = last.get(r.id);
    const daysSince = lp ? Math.max(0, (fromIso(todayIso).getTime() - fromIso(lp).getTime()) / 864e5) : 60;
    let score = rating * 2 + (favs.includes(r.id) ? 3 : 0) + Math.min(daysSince, 60) / 10;
    const mins = totalMinutes(r);
    if (mins && mins <= 30) score += 0.5;
    score += Math.random() * 2.5; // keep it fresh
    return { r, score, veg: dietOf(r).veg };
  });
  scored.sort((a, b) => b.score - a.score);
  const out: Recipe[] = [];
  let lastVeg: boolean | null = null;
  const rest = [...scored];
  while (out.length < count && rest.length) {
    // prefer alternating veggie / non-veggie
    let idx = rest.findIndex((x) => lastVeg === null || x.veg !== lastVeg);
    if (idx < 0) idx = 0;
    const [pick] = rest.splice(idx, 1);
    out.push(pick.r);
    lastVeg = pick.veg;
  }
  return out;
}

export function defaultServings(r: Recipe, household: number): number {
  return household || parseServings(r.servings) || 4;
}
