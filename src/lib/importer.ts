import type { Recipe, RecipeText, Lang, Category } from './types';
import { relayExtract, relayUrl } from './store';
import { normaliseText } from './normalise';
import { fmtMinutes } from './ingredients';

export type Draft = Omit<Recipe, 'id'> & { id?: number };

/* ───────────── schema.org Recipe (JSON-LD) ───────────── */

function findRecipe(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n);
      if (r) return r;
    }
    return null;
  }
  const o = node as Record<string, unknown>;
  const t = o['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return o;
  if (o['@graph']) return findRecipe(o['@graph']);
  if (o.mainEntity) return findRecipe(o.mainEntity);
  return null;
}

function isoToText(iso?: unknown): string {
  if (typeof iso !== 'string') return '';
  const m = iso.match(/P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return '';
  const min = Number(m[1] || 0) * 60 + Number(m[2] || 0);
  return fmtMinutes(min || null);
}

function strip(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

function instructionsOf(x: unknown): string[] {
  if (!x) return [];
  if (typeof x === 'string') return strip(x).split(/(?<=\.)\s+(?=[A-ZÀ-Ý])|\n+/).map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(x)) return x.flatMap(instructionsOf);
  const o = x as Record<string, unknown>;
  if (o['@type'] === 'HowToSection') return instructionsOf(o.itemListElement);
  if (o.text) return [strip(String(o.text))];
  if (o.name) return [strip(String(o.name))];
  return [];
}

function imageOf(x: unknown): string | undefined {
  if (!x) return undefined;
  if (typeof x === 'string') return x;
  if (Array.isArray(x)) return imageOf(x[0]);
  const o = x as Record<string, unknown>;
  return (o.url as string) || (o['@id'] as string) || undefined;
}

export function guessCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/dessert|gâteau|gateau|cake|tarte (?:aux|au) (?:pommes|citron|fraises|chocolat)|cookie|biscuit|crumble|mousse|brownie|muffin|crêpe|pancake|glace|ice cream|sweet|tiramisu|cheesecake/.test(t)) return 'desserts';
  if (/salade|salad|taboul|slaw/.test(t)) return 'salades';
  if (/entrée|starter|appetizer|apéritif|soupe|soup|velouté|dip|houmous|hummus/.test(t)) return 'entrees';
  return 'plats';
}

export function guessEmoji(text: string): string {
  const t = text.toLowerCase();
  const table: [RegExp, string][] = [
    [/pâtes|pasta|spaghetti|lasagn|penne|nouilles|noodle|soba|udon|ramen/, '🍝'],
    [/pizza/, '🍕'], [/burger/, '🍔'], [/taco|tortilla|wrap|burrito/, '🌮'],
    [/curry|dahl|dal\b/, '🍛'], [/riz|rice|risotto|paella/, '🍚'],
    [/soupe|soup|velouté|bouillon/, '🍲'], [/salade|salad/, '🥗'],
    [/saumon|salmon|poisson|fish|cabillaud|thon|tuna/, '🐟'], [/crevette|prawn|shrimp/, '🍤'],
    [/poulet|chicken/, '🍗'], [/bœuf|boeuf|beef|steak/, '🥩'], [/œuf|oeuf|egg|omelette|shakshuka/, '🍳'],
    [/gâteau|cake|cheesecake/, '🍰'], [/tarte|pie|quiche/, '🥧'], [/cookie|biscuit/, '🍪'], [/crêpe|pancake/, '🥞'],
    [/chocolat|chocolate|brownie/, '🍫'], [/citron|lemon/, '🍋'], [/avocat|avocado/, '🥑'], [/tofu|edamame/, '🥢']
  ];
  for (const [re, e] of table) if (re.test(t)) return e;
  return '🍽️';
}

function fromSchema(s: Record<string, unknown>, url?: string): Draft {
  const title = strip(String(s.name || ''));
  const ingredients = ((s.recipeIngredient || s.ingredients || []) as unknown[]).map((x) => strip(String(x))).filter(Boolean);
  const steps = instructionsOf(s.recipeInstructions);
  const yieldRaw = Array.isArray(s.recipeYield) ? s.recipeYield[0] : s.recipeYield;
  const servings = yieldRaw ? String(yieldRaw).match(/\d+/)?.[0] || '' : '';
  const text: RecipeText = { title, ingredients, directions: steps.join('\n'), notes: '' };
  const keywords = typeof s.keywords === 'string' ? s.keywords.split(',').map((k) => k.trim()).filter((k) => k && k.length < 20).slice(0, 4) : [];
  return {
    emoji: guessEmoji(title + ' ' + ingredients.join(' ')),
    category: guessCategory(`${title} ${String(s.recipeCategory || '')}`),
    tags: keywords,
    author: '',
    servings,
    prepTime: isoToText(s.prepTime),
    cookTime: isoToText(s.cookTime),
    totalTime: isoToText(s.totalTime),
    photo: imageOf(s.image),
    sourceUrl: url,
    fr: text
  };
}

/* ───────────── free text (pasted or read from a photo) ───────────── */

const ING_HDR = /^(ingrédients?|ingredients?|mga sangkap|pour \d+|for \d+)\b/i;
const STEP_HDR = /^(préparation|instructions?|method|directions?|étapes?|steps?|recette|pamaagi)\b/i;
const NOTE_HDR = /^(notes?|astuces?|tips?|conseils?)\b/i;
const LOOKS_ING = /^([-•*▢□☐]\s*)?(\d|½|¼|¾|une?\s|a\s|an\s|quelques|some|pinch|pincée|sel|salt|poivre|pepper)/i;

export function parseFreeText(raw: string): Draft {
  const lines = raw.replace(/\r/g, '').split('\n').map((l) => l.replace(/^[\s▢□☐]+/, '').trim()).filter(Boolean);
  let title = '';
  const ings: string[] = [];
  const steps: string[] = [];
  const notes: string[] = [];
  let mode: 'head' | 'ing' | 'step' | 'note' = 'head';
  let servings = '';
  for (const l of lines) {
    const clean = l.replace(/[:：]\s*$/, '');
    if (ING_HDR.test(clean) && clean.length < 40) { mode = 'ing'; const s = clean.match(/\d+/); if (s) servings = s[0]; continue; }
    if (STEP_HDR.test(clean) && clean.length < 40) { mode = 'step'; continue; }
    if (NOTE_HDR.test(clean) && clean.length < 30) { mode = 'note'; continue; }
    if (mode === 'head') {
      if (!title) { title = clean; continue; }
      const s = clean.match(/(?:pour|for|serves|portions?|personnes?)\D{0,12}(\d+)/i);
      if (s) { servings = s[1]; continue; }
      if (LOOKS_ING.test(clean) && clean.length < 80) { mode = 'ing'; ings.push(clean.replace(/^[-•*]\s*/, '')); continue; }
      continue;
    }
    if (mode === 'ing') {
      // a long sentence after the ingredients usually means the method has started
      if (clean.length > 90 && !LOOKS_ING.test(clean)) { mode = 'step'; steps.push(clean.replace(/^\d+[.)]\s*/, '')); continue; }
      ings.push(clean.replace(/^[-•*]\s*/, ''));
    } else if (mode === 'step') steps.push(clean.replace(/^(?:étape|step)?\s*\d+[.):]?\s*/i, ''));
    else notes.push(clean);
  }
  const text: RecipeText = { title: title || 'Nouvelle recette', ingredients: ings, directions: steps.join('\n'), notes: notes.join('\n') };
  return {
    emoji: guessEmoji(text.title + ' ' + ings.join(' ')),
    category: guessCategory(text.title),
    tags: [],
    servings,
    fr: text
  };
}

/* ───────────── entry points ───────────── */

export async function importFromUrl(url: string): Promise<Draft> {
  if (!relayUrl()) throw new Error('no-relay');
  const res = await relayExtract(url);
  const s = findRecipe(res.jsonld);
  if (s) return fromSchema(s, url);
  if (res.html) {
    const d = parseFreeText(res.html);
    if (d.fr && d.fr.ingredients.length > 1) return { ...d, sourceUrl: url, photo: res.image };
  }
  throw new Error('no-recipe');
}

let tesseractLoading: Promise<unknown> | null = null;
function loadTesseract(): Promise<unknown> {
  if (!tesseractLoading) {
    tesseractLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = () => resolve((window as unknown as { Tesseract: unknown }).Tesseract);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return tesseractLoading;
}

export async function importFromImage(file: File, onProgress?: (p: number) => void): Promise<Draft> {
  const T = (await loadTesseract()) as {
    recognize: (img: File, langs: string, opts: { logger: (m: { status: string; progress: number }) => void }) => Promise<{ data: { text: string } }>;
  };
  const { data } = await T.recognize(file, 'fra+eng', {
    logger: (m) => m.status === 'recognizing text' && onProgress?.(m.progress)
  });
  return parseFreeText(data.text);
}

/* ───────────── AI clean-up & translation (via the relay) ───────────── */

export interface AiResult { lang: Lang; fr: RecipeText; en: RecipeText; vi?: RecipeText }

/** Detects the language, translates FR⇄EN (+ Visaya), converts to metric & British English,
 *  and standardises ingredient names. Falls back to the local rules if the relay is unreachable. */
export async function polishRecipe(text: RecipeText, wantVi: boolean): Promise<AiResult | null> {
  if (!relayUrl()) return null;
  try {
    const res = await fetch(`${relayUrl()}/ai/recipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe: text, visaya: wantVi })
    });
    if (!res.ok) return null;
    const out = (await res.json()) as AiResult;
    if (!out.fr?.title || !out.en?.title) return null;
    return {
      lang: out.lang,
      fr: normaliseText(out.fr, 'fr'),
      en: normaliseText(out.en, 'en'),
      vi: out.vi?.title ? normaliseText(out.vi, 'vi') : undefined
    };
  } catch {
    return null;
  }
}

export function detectLang(t: RecipeText): Lang {
  const s = (t.title + ' ' + t.ingredients.join(' ') + ' ' + t.directions).toLowerCase();
  const fr = (s.match(/\b(le|la|les|des|du|de|et|avec|pour|cuillère|faire|ajouter|mélanger)\b/g) || []).length;
  const en = (s.match(/\b(the|and|with|for|add|mix|until|cup|tablespoon|teaspoon|into)\b/g) || []).length;
  return en > fr ? 'en' : 'fr';
}
