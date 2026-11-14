import { useSyncExternalStore } from 'react';
import seedJson from '../data/seed.json';
import type { SharedData, LocalPrefs, Recipe, Member, PlanEntry, ShopExtra, Lang } from './types';
import { applyDelta, mergeDeltas, isEmptyDelta, withSeed, emptyData, type Delta } from './merge';

export type SyncState = 'local' | 'idle' | 'saving' | 'offline' | 'error';

const RELAY_URL: string = (localStorage.getItem('cookbook_relay_override') || import.meta.env.VITE_RELAY_URL || '').replace(/\/$/, '');

const K_DATA = 'cookbook2_data';
const K_PENDING = 'cookbook2_pending';
const K_PREFS = 'cookbook2_prefs';

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full or unavailable: keep in memory */
  }
}

const SEED: SharedData = { ...emptyData(), recipes: (seedJson as { recipes: Recipe[] }).recipes, ratings: (seedJson as { ratings: SharedData['ratings'] }).ratings };

function detectLang(): Lang {
  const l = (navigator.language || 'fr').slice(0, 2);
  return l === 'en' ? 'en' : 'fr';
}

interface State {
  data: SharedData;
  prefs: LocalPrefs;
  sync: SyncState;
  lastSync: number | null;
}

let pending: Delta = read<Delta>(K_PENDING, {});
let state: State = {
  data: applyDelta(withSeed(SEED, read<Partial<SharedData>>(K_DATA, {})), pending),
  prefs: {
    lang: detectLang(),
    favs: [],
    householdServings: 4,
    showLunch: false,
    weeks: 1,
    dietFilters: [],
    ...read<Partial<LocalPrefs>>(K_PREFS, {})
  },
  sync: RELAY_URL ? 'idle' : 'local',
  lastSync: null
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => sel(state)
  );
}
export const getState = () => state;

/* ───────────── prefs (this device only) ───────────── */

export function setPrefs(p: Partial<LocalPrefs>) {
  set({ prefs: { ...state.prefs, ...p } });
  write(K_PREFS, state.prefs);
}
export function toggleFav(id: number) {
  const favs = state.prefs.favs.includes(id) ? state.prefs.favs.filter((x) => x !== id) : [...state.prefs.favs, id];
  setPrefs({ favs });
}

/* ───────────── shared data mutations ───────────── */

let flushTimer: number | undefined;

function change(d: Delta) {
  pending = mergeDeltas(pending, d);
  write(K_PENDING, pending);
  set({ data: applyDelta(state.data, d) });
  if (RELAY_URL) {
    window.clearTimeout(flushTimer);
    flushTimer = window.setTimeout(flush, 1200);
  }
}

export const now = () => Date.now();

export function saveRecipe(r: Recipe) {
  change({ recipes: [{ ...r, updatedAt: now() }] });
}
export function deleteRecipe(id: number) {
  const r = state.data.recipes.find((x) => x.id === id);
  if (!r) return;
  change({ recipes: [{ ...r, deleted: true, updatedAt: now() }] });
}
export function rate(recipeId: number, member: Member, stars: number) {
  const cur = state.data.ratings[String(recipeId)] || {};
  const next = { ...cur, [member]: stars || undefined, t: now() };
  if (!stars) delete next[member];
  change({ ratings: { [String(recipeId)]: next } });
}
export function setSlot(key: string, entry: Omit<PlanEntry, 't'> | null) {
  const v: PlanEntry = entry ? { ...entry, t: now() } : { id: 0, servings: 0, deleted: true, t: now() };
  change({ plan: { [key]: v } });
}
export function setSlots(entries: Record<string, Omit<PlanEntry, 't'> | null>) {
  const t = now();
  const plan: Record<string, PlanEntry> = {};
  for (const [k, e] of Object.entries(entries)) plan[k] = e ? { ...e, t } : { id: 0, servings: 0, deleted: true, t };
  change({ plan });
}
export function setCheck(key: string, checked: boolean) {
  change({ checks: { [key]: { checked, t: now() } } });
}
export function setChecks(keys: string[], checked: boolean) {
  const t = now();
  change({ checks: Object.fromEntries(keys.map((k) => [k, { checked, t }])) });
}
export function upsertExtra(e: Omit<ShopExtra, 't'>) {
  change({ extras: { [e.id]: { ...e, t: now() } } });
}
export function setPantry(key: string, on: boolean) {
  change({ pantry: { [key]: { on, t: now() } } });
}
export function importRecipes(list: Recipe[]) {
  const t = now();
  change({ recipes: list.map((r, i) => ({ ...r, updatedAt: t + i })) });
}

/* ───────────── sync with the relay ───────────── */

let inflight = false;

async function request(method: 'GET' | 'POST', body?: unknown): Promise<Partial<SharedData>> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${RELAY_URL}/data`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`relay-${res.status}`);
    return (await res.json()) as Partial<SharedData>;
  } finally {
    window.clearTimeout(timer);
  }
}

function receive(server: Partial<SharedData>) {
  write(K_DATA, server);
  // server state on top of the seed, then our not-yet-sent changes on top of that
  set({ data: applyDelta(withSeed(SEED, server), pending), lastSync: now() });
}

export async function flush() {
  if (!RELAY_URL || inflight) return;
  if (isEmptyDelta(pending)) return pull();
  inflight = true;
  const sending = pending;
  set({ sync: 'saving' });
  try {
    const server = await request('POST', sending);
    // anything changed while the request was in flight stays pending
    pending = diffPending(pending, sending);
    write(K_PENDING, pending);
    receive(server);
    set({ sync: 'idle' });
  } catch (e) {
    set({ sync: navigator.onLine ? 'error' : 'offline' });
    console.warn('sync failed', e);
  } finally {
    inflight = false;
  }
  if (!isEmptyDelta(pending)) {
    window.clearTimeout(flushTimer);
    flushTimer = window.setTimeout(flush, 3000);
  }
}

function diffPending(cur: Delta, sent: Delta): Delta {
  if (cur === sent) return {};
  // keep only entries whose timestamp is newer than what was sent
  const out: Delta = {};
  const keepMap = <T extends { t?: number }>(c?: Record<string, T>, s?: Record<string, T>) => {
    if (!c) return undefined;
    const r: Record<string, T> = {};
    for (const [k, v] of Object.entries(c)) if (!s || !s[k] || (v.t || 0) > (s[k].t || 0)) r[k] = v;
    return Object.keys(r).length ? r : undefined;
  };
  if (cur.recipes) {
    const sentTs = new Map((sent.recipes || []).map((r) => [r.id, r.updatedAt || 0]));
    const left = cur.recipes.filter((r) => (r.updatedAt || 0) > (sentTs.get(r.id) ?? -1));
    if (left.length) out.recipes = left;
  }
  out.ratings = keepMap(cur.ratings, sent.ratings);
  out.plan = keepMap(cur.plan, sent.plan);
  out.checks = keepMap(cur.checks, sent.checks);
  out.extras = keepMap(cur.extras, sent.extras);
  out.pantry = keepMap(cur.pantry, sent.pantry);
  return out;
}

export async function pull() {
  if (!RELAY_URL || inflight) return;
  inflight = true;
  try {
    receive(await request('GET'));
    set({ sync: 'idle' });
  } catch {
    set({ sync: navigator.onLine ? 'error' : 'offline' });
  } finally {
    inflight = false;
  }
}

export function startSync() {
  if (!RELAY_URL) return;
  flush();
  window.setInterval(() => {
    if (!document.hidden) flush();
  }, 45000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) flush();
  });
  window.addEventListener('online', () => flush());
}

export const relayUrl = () => RELAY_URL;

/** Asks the relay to fetch a recipe page server-side and return its structured data. */
export async function relayExtract(url: string): Promise<{ jsonld: unknown[]; title?: string; image?: string; html?: string }> {
  if (!RELAY_URL) throw new Error('no-relay');
  const res = await fetch(`${RELAY_URL}/extract?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`extract-${res.status}`);
  return res.json();
}

/* ───────────── selectors ───────────── */

export function visibleRecipes(data: SharedData): Recipe[] {
  return data.recipes.filter((r) => !r.deleted);
}
