// Deterministic clean-up applied to every imported or edited recipe:
//  - imperial / US cup measures -> metric
//  - American -> British English (English text only)
//  - one canonical name per ingredient, so the shopping list merges lines across recipes
// The relay's AI pass does the same thing more intelligently; this layer always runs as a safety net.
import type { RecipeText, Lang } from './types';
import { formatNum } from './ingredients';

const US_TO_UK: [RegExp, string][] = [
  [/\ball[- ]purpose flour\b/gi, 'plain flour'],
  [/\bself[- ]rising flour\b/gi, 'self-raising flour'],
  [/\b(?:powdered|confectioners'?) sugar\b/gi, 'icing sugar'],
  [/\bsuperfine sugar\b/gi, 'caster sugar'],
  [/\bgranulated sugar\b/gi, 'caster sugar'],
  [/\b(?:dark |light )?brown sugar\b/gi, 'soft brown sugar'],
  [/\bcornstarch\b/gi, 'cornflour'],
  [/\bbaking soda\b/gi, 'bicarbonate of soda'],
  [/\bheavy (?:whipping )?cream\b/gi, 'double cream'],
  [/\bwhipping cream\b/gi, 'whipping cream'],
  [/\bhalf[- ]and[- ]half\b/gi, 'single cream'],
  [/\bzucchinis?\b/gi, 'courgette'],
  [/\beggplants?\b/gi, 'aubergine'],
  [/\bcilantro\b/gi, 'coriander'],
  [/\b(?:scallions?|green onions?)\b/gi, 'spring onions'],
  [/\barugula\b/gi, 'rocket'],
  [/\bromaine(?: lettuce)?\b/gi, 'cos lettuce'],
  [/\bsnow peas\b/gi, 'mangetout'],
  [/\b(?:fava|lima) beans\b/gi, 'broad beans'],
  [/\bgarbanzo beans\b/gi, 'chickpeas'],
  [/\bbeets\b/gi, 'beetroot'],
  [/\brutabagas?\b/gi, 'swede'],
  [/\b(red|green|yellow|orange) bell peppers?\b/gi, '$1 pepper'],
  [/\bbell peppers?\b/gi, 'pepper'],
  [/\bground (beef|pork|lamb|turkey|chicken)\b/gi, '$1 mince'],
  [/\bshrimps?\b/gi, 'prawns'],
  [/\bcanola oil\b/gi, 'rapeseed oil'],
  [/\bkosher salt\b/gi, 'coarse salt'],
  [/\bcookies\b/gi, 'biscuits'],
  [/\bcandy\b/gi, 'sweets'],
  [/\bplastic wrap\b/gi, 'cling film'],
  [/\baluminum foil\b/gi, 'foil'],
  [/\bparchment paper\b/gi, 'baking paper'],
  [/\bsheet pan\b/gi, 'baking tray'],
  [/\bbaking sheet\b/gi, 'baking tray'],
  [/\bskillet\b/gi, 'frying pan'],
  [/\bstovetop\b/gi, 'hob'],
  [/\bbroil(ed|ing|er)?\b/gi, 'grill$1'],
  [/\bcolor/gi, 'colour'],
  [/\bflavor/gi, 'flavour'],
  [/\bcenter\b/gi, 'centre'],
  [/\bfavorite/gi, 'favourite'],
  [/\bliter\b/gi, 'litre'],
  [/\bliters\b/gi, 'litres'],
  [/\bcaramelize/gi, 'caramelise'],
  [/\bcaramelizing/gi, 'caramelising']
];

// cup -> grams for common dry ingredients (UK baking conventions)
const CUP_GRAMS: [RegExp, number][] = [
  [/flour|farine/i, 125],
  [/icing sugar|powdered|sucre glace/i, 120],
  [/brown sugar|sucre (?:roux|brun)/i, 200],
  [/sugar|sucre/i, 200],
  [/butter|beurre/i, 225],
  [/rice|riz/i, 185],
  [/oats|avoine/i, 90],
  [/quinoa/i, 170],
  [/lentil|lentille/i, 190],
  [/cheese|fromage|parmesan/i, 100],
  [/nuts|almonds|walnut|noix|amande|cashew|cajou/i, 140],
  [/cocoa|cacao/i, 100],
  [/breadcrumbs|chapelure/i, 60],
  [/chocolate chips|pépites/i, 170],
  [/spinach|épinard|kale|rocket|roquette|salad|herbs|parsley|coriander|basil|persil|coriandre|basilic/i, 30],
  [/peas|petits pois|corn|maïs|beans|haricots/i, 150],
  [/berries|blueberr|raspberr|myrtille|framboise/i, 150]
];

function cupsTo(n: number, rest: string): string {
  for (const [re, g] of CUP_GRAMS) if (re.test(rest)) return `${formatNum(roundNice(n * g))} g`;
  // liquids (and anything unknown) go by volume
  return `${formatNum(roundNice(n * 240))} ml`;
}

function roundNice(x: number): number {
  if (x >= 100) return Math.round(x / 5) * 5;
  if (x >= 20) return Math.round(x);
  return Math.round(x * 2) / 2;
}

const NUM = '(\\d+(?:[.,]\\d+)?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+|[½¼¾⅓⅔])';

function toNumber(s: string): number {
  const map: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
  if (map[s] !== undefined) return map[s];
  const parts = s.trim().split(/\s+/);
  let total = 0;
  for (const p of parts) {
    if (p.includes('/')) {
      const [a, b] = p.split('/');
      total += Number(a) / Number(b);
    } else total += parseFloat(p.replace(',', '.'));
  }
  return total;
}

/** Convert imperial/US measures in an ingredient line or instruction to metric. */
export function toMetric(line: string): string {
  let s = line;
  // "1 ½ cups" -> "1.5 cups"
  s = s.replace(/(\d+)\s*([½¼¾⅓⅔])/g, (_, a, f) => String(Number(a) + toNumber(f)));
  // cups
  s = s.replace(new RegExp(NUM + '\\s*(?:cups?|c\\.)\\b(.*)', 'i'), (_, n, rest) => {
    const conv = cupsTo(toNumber(n), rest);
    return conv ? `${conv}${rest}` : _;
  });
  // fl oz before oz
  s = s.replace(new RegExp(NUM + '\\s*(?:fl\\.?\\s*oz|fluid ounces?)\\b', 'gi'), (_, n) => `${formatNum(roundNice(toNumber(n) * 30))} ml`);
  s = s.replace(new RegExp(NUM + '\\s*(?:oz|ounces?)\\b', 'gi'), (_, n) => `${formatNum(roundNice(toNumber(n) * 28))} g`);
  s = s.replace(new RegExp(NUM + '\\s*(?:lbs?|pounds?)\\b', 'gi'), (_, n) => {
    const g = toNumber(n) * 454;
    return g >= 1000 ? `${formatNum(Math.round(g / 50) / 20)} kg` : `${formatNum(roundNice(g))} g`;
  });
  s = s.replace(new RegExp(NUM + '\\s*(?:sticks?) (?:of )?butter', 'gi'), (_, n) => `${formatNum(roundNice(toNumber(n) * 115))} g butter`);
  s = s.replace(new RegExp(NUM + '\\s*(?:pints?)\\b', 'gi'), (_, n) => `${formatNum(roundNice(toNumber(n) * 473))} ml`);
  s = s.replace(new RegExp(NUM + '\\s*(?:quarts?)\\b', 'gi'), (_, n) => `${formatNum(roundNice(toNumber(n) * 946))} ml`);
  s = s.replace(new RegExp(NUM + '\\s*(?:-|–)?\\s*(?:inch(?:es)?|in\\.|")(?=[\\s,.)]|$)', 'gi'), (_, n) => `${formatNum(Math.round(toNumber(n) * 2.5))} cm`);
  // temperatures: 350°F / 350 F / 350 degrees F
  s = s.replace(/(\d{2,3})\s*(?:°|º|degrees?\s*)\s*F\b/gi, (_, f) => {
    const c = Math.round(((Number(f) - 32) * 5) / 9 / 5) * 5;
    return `${c}°C`;
  });
  return s;
}

export function usToUk(text: string): string {
  let s = text;
  for (const [re, rep] of US_TO_UK) s = s.replace(re, (m, ...g) => matchCase(m, rep.replace(/\$(\d)/g, (_, i) => g[Number(i) - 1] || '')));
  return s;
}

function matchCase(src: string, rep: string): string {
  if (src[0] && src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()) return rep.charAt(0).toUpperCase() + rep.slice(1);
  return rep;
}

/** Canonical ingredient names: one name per ingredient in each language. */
const CANON: Record<Lang, [RegExp, string][]> = {
  fr: [
    [/\b(?:oignons? nouveaux?|cébettes?|ciboules?|oignons? de printemps)\b/gi, 'oignons verts'],
    [/\bcoriandre fraîche\b/gi, 'coriandre'],
    [/\bpersil plat\b/gi, 'persil'],
    [/\bcrème fraîche épaisse\b/gi, 'crème fraîche'],
    [/\bhuile d'olive vierge extra\b/gi, "huile d'olive"],
    [/\bhuile d’olive\b/gi, "huile d'olive"],
    [/\bsauce soya\b/gi, 'sauce soja'],
    [/\bpoivron rouge\b/gi, 'poivron rouge'],
    [/\bfilets? de poulet\b/gi, 'blancs de poulet'],
    [/\bescalopes? de poulet\b/gi, 'blancs de poulet'],
    [/\bpommes? de terre à chair ferme\b/gi, 'pommes de terre'],
    [/\bpois chiches? cuits?\b/gi, 'pois chiches']
  ],
  en: [
    [/\bextra[- ]virgin olive oil\b/gi, 'olive oil'],
    [/\bfresh coriander\b/gi, 'coriander'],
    [/\bflat[- ]leaf parsley\b/gi, 'parsley'],
    [/\bchicken breasts?(?: fillets?)?\b/gi, 'chicken breasts'],
    [/\bsoy sauce\b/gi, 'soy sauce'],
    [/\bgarlic cloves?\b/gi, 'cloves garlic'],
    [/\bcherry tomatoes\b/gi, 'cherry tomatoes']
  ],
  vi: []
};

export function canonicalise(line: string, lang: Lang): string {
  let s = line;
  for (const [re, rep] of CANON[lang]) s = s.replace(re, (m) => matchCase(m, rep));
  return s;
}

/** Full clean-up of one language version of a recipe. */
export function normaliseText(t: RecipeText, lang: Lang): RecipeText {
  const fixIng = (l: string) => {
    let s = l.replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim();
    s = toMetric(s);
    if (lang === 'en') s = usToUk(s);
    return canonicalise(s, lang);
  };
  const fixStep = (l: string) => {
    let s = toMetric(l.replace(/[​ ]/g, ' ').trim());
    if (lang === 'en') s = usToUk(s);
    return s;
  };
  return {
    ...t,
    title: lang === 'en' ? usToUk(t.title) : t.title,
    ingredients: (t.ingredients || []).map(fixIng).filter(Boolean),
    directions: (t.directions || '').split(/\n/).map(fixStep).filter(Boolean).join('\n'),
    notes: t.notes ? (lang === 'en' ? usToUk(toMetric(t.notes)) : toMetric(t.notes)) : t.notes
  };
}
