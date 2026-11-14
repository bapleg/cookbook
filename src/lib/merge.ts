// Last-write-wins merging, shared by the app and the relay worker (worker/src/merge.js is a copy).
import type { Recipe, Ratings, Plan, Shopping, SharedData } from './types';

export interface Delta {
  recipes?: Recipe[];
  ratings?: Ratings;
  plan?: Plan['slots'];
  checks?: Shopping['checks'];
  extras?: Shopping['extras'];
  pantry?: Shopping['pantry'];
}

const ts = (r: Recipe) => r.updatedAt || (r as unknown as { tv?: number }).tv || 0;

export function mergeRecipes(base: Recipe[], incoming: Recipe[]): Recipe[] {
  const byId = new Map<number, Recipe>();
  for (const r of base) byId.set(r.id, r);
  for (const r of incoming) {
    const cur = byId.get(r.id);
    if (!cur || ts(r) >= ts(cur)) byId.set(r.id, r);
  }
  return [...byId.values()];
}

function mergeMap<T extends { t?: number }>(a: Record<string, T> = {}, b: Record<string, T> = {}): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    if (!cur || (v.t || 0) >= (cur.t || 0)) out[k] = v;
  }
  return out;
}

export function emptyData(): SharedData {
  return { recipes: [], ratings: {}, plan: { slots: {} }, shopping: { checks: {}, extras: {}, pantry: {} } };
}

export function applyDelta(data: SharedData, d: Delta): SharedData {
  return {
    recipes: d.recipes ? mergeRecipes(data.recipes, d.recipes) : data.recipes,
    ratings: d.ratings ? mergeMap(data.ratings, d.ratings) : data.ratings,
    plan: d.plan ? { slots: mergeMap(data.plan.slots, d.plan) } : data.plan,
    shopping: {
      checks: d.checks ? mergeMap(data.shopping.checks, d.checks) : data.shopping.checks,
      extras: d.extras ? mergeMap(data.shopping.extras, d.extras) : data.shopping.extras,
      pantry: d.pantry ? mergeMap(data.shopping.pantry, d.pantry) : data.shopping.pantry
    }
  };
}

export function mergeDeltas(a: Delta, b: Delta): Delta {
  return {
    recipes: a.recipes || b.recipes ? mergeRecipes(a.recipes || [], b.recipes || []) : undefined,
    ratings: a.ratings || b.ratings ? mergeMap(a.ratings, b.ratings) : undefined,
    plan: a.plan || b.plan ? mergeMap(a.plan, b.plan) : undefined,
    checks: a.checks || b.checks ? mergeMap(a.checks, b.checks) : undefined,
    extras: a.extras || b.extras ? mergeMap(a.extras, b.extras) : undefined,
    pantry: a.pantry || b.pantry ? mergeMap(a.pantry, b.pantry) : undefined
  };
}

export function isEmptyDelta(d: Delta): boolean {
  return !Object.values(d).some((v) => v && (Array.isArray(v) ? v.length : Object.keys(v).length));
}

/** Merge server state on top of the bundled seed (seed = built-in recipes the gist never stored). */
export function withSeed(seed: SharedData, server: Partial<SharedData>): SharedData {
  return applyDelta(seed, {
    recipes: server.recipes,
    ratings: server.ratings,
    plan: server.plan?.slots,
    checks: server.shopping?.checks,
    extras: server.shopping?.extras,
    pantry: server.shopping?.pantry
  });
}
