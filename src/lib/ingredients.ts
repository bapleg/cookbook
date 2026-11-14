import type { Recipe, RecipeText, Lang, DietFilter } from './types';

/* ───────────── numbers & scaling ───────────── */

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '0.5', '¼': '0.25', '¾': '0.75', '⅓': '0.333', '⅔': '0.667', '⅛': '0.125', '⅜': '0.375', '⅝': '0.625', '⅞': '0.875'
};

export function normaliseFractions(s: string): string {
  let t = s.replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g, (c) => ' ' + UNICODE_FRACTIONS[c]);
  // "1 0.5" (from "1½") -> 1.5
  t = t.replace(/(\d+)\s+0\.(\d+)/g, (_, a, b) => String(Number(a) + Number('0.' + b)));
  t = t.replace(/(\d+)\s*\/\s*(\d+)/g, (_, n, d) => String(Number(n) / Number(d)));
  return t.replace(/^\s+/, '');
}

export function formatNum(n: number): string {
  if (!isFinite(n)) return '';
  if (n >= 100) return String(Math.round(n / 5) * 5);
  if (n >= 10) return String(Math.round(n));
  const r = Math.round(n * 4) / 4; // nearest quarter for small amounts
  const whole = Math.floor(r);
  const frac = r - whole;
  const fracStr = frac === 0.25 ? '¼' : frac === 0.5 ? '½' : frac === 0.75 ? '¾' : '';
  if (r === 0) return String(Math.round(n * 10) / 10 || n.toFixed(2));
  return whole === 0 ? fracStr : `${whole}${fracStr}`;
}

/** Scale every quantity in an ingredient line. Returns the original line when ratio is 1. */
export function scaleLine(text: string, ratio: number): string {
  if (!text || ratio === 1) return text;
  const t = normaliseFractions(text);
  return t.replace(/(^|[\s,~≈(x×])(\d+(?:[.,]\d+)?)(?!\s*(?:°|%|cm|mm|min|h\b|heures?|minutes?|secondes?))/g, (m, pre, num) => {
    const n = parseFloat(num.replace(',', '.'));
    if (isNaN(n)) return m;
    return pre + formatNum(n * ratio);
  });
}

export function parseServings(s?: string): number | null {
  if (!s) return null;
  const m = String(s).match(/(\d+)(?:\s*[-–à]\s*(\d+))?/);
  if (!m) return null;
  return Number(m[1]);
}

export function parseMinutes(s?: string): number | null {
  if (!s) return null;
  const str = String(s).toLowerCase().trim();
  if (!str || str === '0') return null;
  let total = 0;
  const h = str.match(/(\d+(?:[.,]\d+)?)\s*h/);
  if (h) total += parseFloat(h[1].replace(',', '.')) * 60;
  const after = str.match(/h\s*(\d+)/);
  if (after) total += Number(after[1]);
  const min = str.match(/(\d+)\s*(?:min|mn|m\b)/);
  if (min && !after) total += Number(min[1]);
  if (!h && !min) {
    const bare = str.match(/^(\d+)$/);
    if (bare) total = Number(bare[1]);
  }
  return total || null;
}

export function totalMinutes(r: Recipe): number | null {
  const tot = parseMinutes(r.totalTime);
  if (tot) return tot;
  const p = parseMinutes(r.prepTime) || 0;
  const c = parseMinutes(r.cookTime) || 0;
  return p + c || null;
}

export function fmtMinutes(m: number | null): string {
  if (!m) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r}` : `${h} h`;
}

/* ───────────── recipe text helpers ───────────── */

export function textFor(r: Recipe, lang: Lang): RecipeText {
  const order: Lang[] = [lang, 'fr', 'en', 'vi'];
  for (const l of order) {
    const t = r[l];
    if (t && t.title) return t;
  }
  return { title: '—', ingredients: [], directions: '' };
}

export function stepsOf(t: RecipeText): string[] {
  return (t.directions || '')
    .split(/\n+/)
    .map((s) => s.replace(/^[\s​]*(\d+[.)]\s*|[-•*]\s*)?/, '').trim())
    .filter(Boolean);
}

export function cleanLine(s: string): string {
  return s.replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isSectionHeader(line: string): boolean {
  const l = cleanLine(line);
  return /:$/.test(l) && l.length < 40 && !/\d/.test(l);
}

/* ───────────── diet detection ───────────── */

const GLUTEN = /farine(?! de (riz|maïs|mais|sarrasin|coco|pois|châtaigne))|\bblé\b|froment|semoule|boulgour|\borge\b|seigle|pâtes|\bpates\b|penne|spaghetti|coquillette|gigli|conchiglioni|macaroni|nouilles|\bpain\b|pita|tortilla(?!s? de maïs)|couscous|chapelure|biscuit|brioche|\bpasta\b|\bbread\b|noodle|barley|\brye\b|\bflour\b(?! *\(gluten)|sauce soja(?! sans gluten)|soy sauce(?! *\(gluten)|bière|\bbeer\b|harina(?! sa bugas)/i;
const DAIRY = /\blait\b(?! de coco| de soja| d.amande| d.avoine| de riz)|beurre|crème|creme|fromage|ricotta|parmesan|\bfeta\b|cheddar|mozzarella|mascarpone|yaourt|yogurt|\bmilk\b(?! *\(coconut)|\bbutter\b(?!nut)|\bcream\b(?! of tartar)|cheese|\bgatas\b(?! sa lubi)|mantikilia|\bkeso\b/i;
const EGG = /œuf|\boeufs?\b|\beggs?\b|\bitlog\b|jaunes? d|mayonnaise/i;
const MEAT = /poulet|bœuf|boeuf|\bporc\b|veau|agneau|canard|dinde|jambon|lardon|saucisse|chorizo|viande|steak|saumon|\bthon\b|cabillaud|\bcolin\b|églefin|\bsole\b|crevette|poisson|anchois|chicken|\bbeef\b|\bpork\b|\blamb\b|\bduck\b|turkey|\bham\b|bacon|sausage|\bmeat\b|salmon|\btuna\b|\bcod\b|\bfish\b|shrimp|prawn|manok|\bbaka\b|baboy|\bisda\b|karnero|patis|sauce poisson|fish sauce/i;

export interface Diet { veg: boolean; gf: boolean; df: boolean; ef: boolean }

export function dietOf(r: Recipe): Diet {
  const tags = (r.tags || []).map((t) => t.toLowerCase());
  const txt = ['fr', 'en'].map((l) => (r[l as Lang]?.ingredients || []).join(' \n ')).join(' \n ');
  const has = (...words: string[]) => tags.some((t) => words.some((w) => t.includes(w)));
  return {
    gf: has('sans gluten', 'gluten-free', 'gluten free') || !GLUTEN.test(txt),
    df: has('sans lait', 'sans lactose', 'dairy-free', 'dairy free') || !DAIRY.test(txt),
    ef: has('sans œufs', 'sans oeufs', 'egg-free', 'egg free') || !EGG.test(txt),
    veg: has('vege', 'végé', 'vegetarian', 'vegan', 'vegatarian') || !MEAT.test(txt)
  };
}

export function matchesDiet(r: Recipe, d: Diet, filters: DietFilter[]): boolean {
  for (const f of filters) {
    if (f === 'quick') {
      const m = totalMinutes(r);
      if (!m || m > 30) return false;
    } else if (!d[f]) return false;
  }
  return true;
}

/* ───────────── shopping list engine ───────────── */

export type Aisle = 'produce' | 'meat' | 'dairy' | 'grains' | 'tins' | 'spices' | 'frozen' | 'other';
export const AISLE_ORDER: Aisle[] = ['produce', 'meat', 'dairy', 'grains', 'tins', 'spices', 'frozen', 'other'];
export const AISLE_EMOJI: Record<Aisle, string> = {
  produce: '🥦', meat: '🥩', dairy: '🧀', grains: '🌾', tins: '🥫', spices: '🧂', frozen: '🧊', other: '🛒'
};

const AISLE_RULES: [Aisle, RegExp][] = [
  ['frozen', /surgel|frozen|congel/i],
  ['spices', /cayenne|huile|\boil\b|vinaigre|vinegar|sauce soja|soy sauce|tamari|paprika|cumin|curcuma|turmeric|cannelle|cinnamon|muscade|nutmeg|sumac|za'?atar|garam|curry powder|chil(l)?i (?:flakes|powder)|piment (?:d'espelette|en poudre)|\bsel\b|\bsalt\b|black pepper|poivre noir|stock cube|cube de bouillon|bouillon cube|honey|miel|\bsugar\b|\bsucre\b|sirop|syrup/i],
  ['tins', /crushed tomato|chopped tomato|tomates? concassées|tomates? pelées|tinned|canned|conserve|en boîte|\bboîte\b|\bcan(ned)?\b|\btin(ned)?\b|bocal|passata|coulis|concentré de tomate|tomato paste|lait de coco|coconut milk|pois chiches?|chickpea|haricots? (rouges?|blancs?|noirs?)|kidney|black beans|cannellini|maïs doux|sweetcorn|olives? (?:noires|vertes|kalamata)|black olives|green olives|câpres?|capers|pesto|tahini|cornichon|pickles?|bouillon|stock|\bthon\b|tuna/i],
  ['meat', /poulet|blanc de volaille|volaille|bœuf|boeuf|\bporc\b|veau|agneau|canard|saumon|\bthon\b|poisson|cabillaud|crevette|viande|haché|jambon|lardon|bacon|merguez|saucisse|chorizo|dinde|lapin|chicken|beef|pork|lamb|salmon|\bfish\b|\bcod\b|shrimp|prawn|\bmeat\b|mince|\bham\b|turkey|rabbit|sausage|manok|baboy|isda|anchois|anchov/i],
  ['dairy', /\blait\b(?! de coco)|crème|creme|fromage|beurre|yaourt|yogourt|ricotta|parmesan|mozzarella|gruyère|emmental|comté|chèvre|feta|mascarpone|cheddar|burrata|œuf|oeuf|\bmilk\b|cream|cheese|butter|yog(h)?urt|\beggs?\b|halloumi|skyr|tofu/i],
  ['grains', /pâtes?|\bpates?\b|\briz\b|\bpain\b|farine|semoule|couscous|quinoa|boulgour|spaghetti|tagliatelle|penne|nouilles?|soba|udon|tortilla|wrap|pita|chapelure|maïzena|flocons d'avoine|avoine|sarrasin|lentilles?|pois cassés|pasta|\brice\b|bread|flour|noodle|oats?|buckwheat|lentils?|polenta|gnocchi|brioche|baguette|pâte feuilletée|pâte brisée|puff pastry|levure|yeast|baking powder/i],
  ['spices', /\bsel\b|poivre(?! rouge| vert| jaune|on)|épice|cumin|paprika|curcuma|curry|cannelle|muscade|piment|moutarde|vinaigre|sauce soja|tamari|soy sauce|huile|sucre|miel|sirop|ketchup|mayonnaise|harissa|sriracha|sauce|\bsalt\b|black pepper|spice|turmeric|cinnamon|nutmeg|chil(l)?i flakes|mustard|vinegar|\boil\b|sugar|honey|syrup|vanill|origan|oregano|herbes de provence|za'?atar|sumac|garam|ras el hanout|bicarbonate|cacao|chocolat|cocoa|chocolate|graines de sésame|sesame seeds/i],
  ['produce', /épinard|tomat|oignon|\bail\b|carotte|poivron|courgett|aubergine|pomme(?! de terre)?|pommes? de terre|patate|banane|citron|salade|laitue|roquette|avocat|concombre|champignon|brocoli|chou|navet|poireau|betterave|radis|fenouil|céleri|persil|coriandre|basilic|menthe|ciboulette|aneth|estragon|thym|romarin|laurier|échalote|gingembre|haricots? verts?|petits? pois|potiron|courge|butternut|panais|asperge|fruit|fraise|framboise|myrtille|orange|mangue|ananas|raisin|poire|pêche|abricot|cerise|kiwi|grenade|edamame|pak choi|bok choy|oignons? verts?|cébette|spinach|tomato|onion|garlic|carrot|pepper|zucchini|courgette|eggplant|apple|potato|banana|lemon|lime|lettuce|rocket|avocado|cucumber|mushroom|broccoli|cabbage|kale|leek|beetroot|celery|parsley|coriander|cilantro|basil|mint|chives|dill|thyme|rosemary|bay lea|shallot|ginger|green beans|peas|pumpkin|squash|parsnip|asparagus|berries|spring onion|scallion|bean sprouts|pousses|herbs?/i]
];

export function aisleOf(name: string): Aisle {
  for (const [a, re] of AISLE_RULES) if (re.test(name)) return a;
  return 'other';
}

/** Staples most kitchens already have; shown in a separate "pantry" section unless the family opts in. */
const PANTRY_RE = /^(sea salt|sea salt and pepper|salt & pepper|sel & poivre|sel et poivre du moulin|sel|gros sel|fleur de sel|poivre|poivre noir|huile|huile d'olive|huile de tournesol|huile neutre|huile végétale|sucre|sucre en poudre|farine|eau|eau chaude|eau froide|salt|pepper|black pepper|salt and pepper|sel et poivre|sel, poivre|olive oil|oil|vegetable oil|sugar|flour|water|vinaigre|vinegar|moutarde|mustard|sauce soja|soy sauce|maïzena|cornstarch|levure chimique|baking powder|bicarbonate|baking soda|paprika|cumin|cannelle|cinnamon|curry|herbes de provence|thym séché|laurier|bay leaf|bay leaves|origan|oregano|piment|chili flakes|ketchup|miel|honey)$/i;

export function isStaple(name: string): boolean {
  return PANTRY_RE.test(name.trim());
}

const UNIT_ALIASES: Record<string, string> = {
  g: 'g', gr: 'g', gramme: 'g', grammes: 'g', grams: 'g', gram: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg',
  ml: 'ml', cl: 'cl', dl: 'dl', l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  'c.à.s': 'cs', 'c. à s.': 'cs', 'càs': 'cs', 'cas': 'cs', cs: 'cs', 'cuillère à soupe': 'cs', 'cuillères à soupe': 'cs', tbsp: 'cs', tablespoon: 'cs', tablespoons: 'cs', kutsara: 'cs',
  'c.à.c': 'cc', 'càc': 'cc', 'cac': 'cc', cc: 'cc', 'cuillère à café': 'cc', 'cuillères à café': 'cc', tsp: 'cc', teaspoon: 'cc', teaspoons: 'cc', kutsarita: 'cc',
  tasse: 'cup', tasses: 'cup', cup: 'cup', cups: 'cup', tasa: 'cup',
  pincée: 'pincée', pincées: 'pincée', pinch: 'pincée',
  gousse: 'gousse', gousses: 'gousse', clove: 'gousse', cloves: 'gousse',
  boîte: 'boîte', boîtes: 'boîte', can: 'boîte', cans: 'boîte', tin: 'boîte', tins: 'boîte', lata: 'boîte',
  sachet: 'sachet', sachets: 'sachet', paquet: 'paquet', paquets: 'paquet', pack: 'paquet', packet: 'paquet',
  botte: 'botte', bottes: 'botte', bouquet: 'botte', bouquets: 'botte', bunch: 'botte', bunches: 'botte',
  tranche: 'tranche', tranches: 'tranche', slice: 'tranche', slices: 'tranche',
  filet: 'filet', filets: 'filet', fillet: 'filet', fillets: 'filet',
  feuille: 'feuille', feuilles: 'feuille', branche: 'branche', branches: 'branche', brin: 'branche', brins: 'branche', sprig: 'branche', sprigs: 'branche',
  oz: 'oz', lb: 'lb', lbs: 'lb'
};
const UNIT_RE = new RegExp(
  '^(' + Object.keys(UNIT_ALIASES).sort((a, b) => b.length - a.length).map((u) => u.replace(/[.]/g, '\\.')).join('|') + ')(?=$|[\\s.,])\\.?',
  'i'
);

const PREP_WORDS = /\b(battue?s?|fondue?s?|hachée?s?|émincée?s?|râpée?s?|coupée?s?|tranchée?s?|pressée?s?|pilée?s?|ciselée?s?|pelée?s?|épluchée?s?|égouttée?s?|rincée?s?|concassée?s?|dénoyautée?s?|émiettée?s?|surgelée?s?|fraîches?|frais|secs?|sèches?|séchée?s?|moulue?s?|entière?s?|entiers?|tièdes?|mou|ramollie?|cuite?s?|cuits?|crue?s?|crus?|finement|grossièrement|en dés|en morceaux|en rondelles|en lamelles|en cubes|en quartiers|bien mûrs?|mûre?s?|bio|crushed|extra[- ]virgin|vierge extra|juice of|jus de|zest of|chopped|minced|diced|sliced|grated|crushed|fresh|dried|ground|whole|melted|beaten|softened|peeled|drained|rinsed|finely|roughly|thinly|large|small|medium|big|petite?s?|grande?s?|gros|grosses?|environ|about|approx\.?)\b/gi;

export interface ParsedIng { qty: number | null; unit: string; name: string; raw: string }

export function parseIngredient(line: string): ParsedIng {
  const raw = cleanLine(line);
  let s = normaliseFractions(raw.replace(/^[-•*]\s*/, ''));
  let qty: number | null = null;
  const q = s.match(/^(\d+(?:[.,]\d+)?)(?:\s*(?:-|à|to)\s*(\d+(?:[.,]\d+)?))?\s*(?:x|×)?\s*/i);
  if (q) {
    qty = parseFloat((q[2] || q[1]).replace(',', '.'));
    s = s.slice(q[0].length);
  }
  // glued unit: "200g"
  let unit = '';
  const um = s.match(UNIT_RE);
  if (um) {
    unit = UNIT_ALIASES[um[1].toLowerCase()] || um[1].toLowerCase();
    s = s.slice(um[0].length);
  }
  // "x 170 g filets de saumon" -> secondary weight in brackets is dropped
  s = s.replace(/^\s*(de |d'|d’|of |ng |sa )/i, '');
  return { qty, unit, name: s.trim(), raw };
}

export function cleanLabel(name: string): string {
  let t = name.replace(/\([^)]*\)/g, ' ').replace(/^(optional|facultatif|optionnel)\s*:?\s*/i, '');
  t = t.split(/[,;]| - | – /)[0];
  t = t.replace(PREP_WORDS, ' ').replace(/^\s*(of |de |d'|d’)/i, '').replace(/\s+/g, ' ').trim();
  return t || name.trim();
}

/** Canonical key used to merge the same ingredient across recipes. */
export function ingredientKey(name: string): string {
  let t = name.toLowerCase().replace(/^(optional|facultatif|optionnel)\s*:?\s*/i, '');
  t = t.replace(/\([^)]*\)/g, ' ').split(/[,;:]| - | – |\bou\b|\bor\b|\bpour\b|\bfor\b/)[0];
  t = t.replace(/\b\d+([.,]\d+)?\s?(kg|g|ml|cl|l|oz|lbs?)\b/g, ' ');
  t = t.replace(PREP_WORDS, ' ');
  t = t.replace(/^\s*(de |des |du |d'|d’|la |le |les |l'|l’|the |a |an |of )+/i, '');
  t = t.replace(/[^a-zà-ÿœæ' -]/gi, ' ').replace(/\s+/g, ' ').trim();
  // crude singular
  t = t
    .split(' ')
    .map((w) => (w.length > 3 && /[^s]s$/.test(w) && !/(ss|us|is)$/.test(w) ? w.slice(0, -1) : w.replace(/(x)$/, w.endsWith('eaux') ? '' : 'x')))
    .join(' ');
  return t || name.toLowerCase().trim();
}

function toBase(qty: number, unit: string): { qty: number; unit: string } {
  switch (unit) {
    case 'kg': return { qty: qty * 1000, unit: 'g' };
    case 'l': return { qty: qty * 1000, unit: 'ml' };
    case 'dl': return { qty: qty * 100, unit: 'ml' };
    case 'cl': return { qty: qty * 10, unit: 'ml' };
    case 'lb': return { qty: qty * 454, unit: 'g' };
    case 'oz': return { qty: qty * 28, unit: 'g' };
    default: return { qty, unit };
  }
}

function prettyQty(qty: number, unit: string, lang: Lang): string {
  const en = lang !== 'fr';
  if (unit === 'g' && qty >= 1000) return `${formatNum(qty / 1000)} kg`;
  if (unit === 'ml' && qty >= 1000) return `${formatNum(qty / 1000)} l`;
  if (unit === 'ml' && qty >= 100) return `${formatNum(qty / 10)} cl`;
  const names: Record<string, [string, string]> = { cs: ['c. à s.', 'tbsp'], cc: ['c. à c.', 'tsp'], 'boîte': ['boîte', 'tin'], botte: ['botte', 'bunch'], gousse: ['gousse', 'clove'], tranche: ['tranche', 'slice'], filet: ['filet', 'fillet'], feuille: ['feuille', 'leaf'], branche: ['branche', 'sprig'], sachet: ['sachet', 'sachet'], paquet: ['paquet', 'pack'], 'pincée': ['pincée', 'pinch'], cup: ['tasse', 'cup'] };
  let u = names[unit] ? names[unit][en ? 1 : 0] : unit;
  if (qty > 1 && names[unit]) u = en ? (u === 'leaf' ? 'leaves' : u === 'pinch' ? 'pinches' : /tbsp|tsp/.test(u) ? u : u + 's') : u.includes('.') ? u : u + 's';
  return `${formatNum(qty)}${u ? (u === 'g' || u === 'ml' ? ' ' : ' ') + u : ''}`;
}

export interface ShopLine {
  key: string;
  label: string;
  amounts: string[];
  aisle: Aisle;
  staple: boolean;
  recipes: string[];
  details: string[]; // original lines, for the "for:" hint
}

export interface ShopSource { recipe: Recipe; ratio: number; title: string }

export function buildShoppingList(sources: ShopSource[], lang: Lang): ShopLine[] {
  const map = new Map<string, { label: string; raw: string; qtys: Map<string, number>; loose: number; recipes: Set<string>; details: string[]; noQty: boolean }>();
  for (const { recipe, ratio, title } of sources) {
    const txt = textFor(recipe, lang);
    for (const line of txt.ingredients || []) {
      if (!cleanLine(line) || isSectionHeader(line)) continue;
      const p = parseIngredient(scaleLine(line, ratio));
      const key = ingredientKey(p.name);
      if (!key) continue;
      let e = map.get(key);
      if (!e) {
        const labelBase = cleanLabel(p.name);
        e = { label: labelBase.charAt(0).toUpperCase() + labelBase.slice(1), raw: p.name.toLowerCase() + ' ' + p.unit, qtys: new Map(), loose: 0, recipes: new Set(), details: [], noQty: false };
        map.set(key, e);
      }
      e.recipes.add(title);
      e.details.push(`${cleanLine(line)} — ${title}`);
      if (p.qty == null) e.noQty = true;
      else {
        const b = toBase(p.qty, p.unit);
        if (b.unit) e.qtys.set(b.unit, (e.qtys.get(b.unit) || 0) + b.qty);
        else e.loose += b.qty;
      }
    }
  }
  const out: ShopLine[] = [];
  for (const [key, e] of map) {
    const amounts: string[] = [];
    if (e.loose) amounts.push(formatNum(e.loose));
    for (const [u, q] of e.qtys) amounts.push(prettyQty(q, u, lang));
    out.push({
      key,
      label: e.label,
      amounts,
      aisle: /boîte/.test(e.raw) ? 'tins' : aisleOf(e.raw + ' ' + key),
      staple: isStaple(key) || isStaple(e.label),
      recipes: [...e.recipes],
      details: e.details
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}
