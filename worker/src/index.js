// Family Cookbook relay — a tiny Cloudflare Worker that
//  1. reads/writes the family data in a private GitHub gist (the token never reaches the browser),
//  2. fetches recipe pages server-side for "import from a link" (no flaky public CORS proxies),
//  3. uses Workers AI to translate and standardise imported recipes.
//
// Secrets (Cloudflare dashboard → Worker → Settings → Variables and secrets):
//   GIST_TOKEN   GitHub token with the "gist" scope            (required)
//   WRITE_KEY    optional password; when set, writes need it     (optional, for later)
// Vars (wrangler.toml): GIST_ID, ALLOWED_ORIGINS

const FILES = ['recipes.json', 'ratings.json', 'plan.json', 'shopping.json'];
const MAX_BODY = 4 * 1024 * 1024;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      let res;
      if (url.pathname === '/' || url.pathname === '/health') res = json({ ok: true, service: 'cookbook-relay', ai: !!env.AI, gist: !!env.GIST_TOKEN });
      else if (url.pathname === '/data' && req.method === 'GET') res = json(await loadData(env));
      else if (url.pathname === '/data' && req.method === 'POST') res = await postData(req, env);
      else if (url.pathname === '/extract' && req.method === 'GET') res = await extract(url.searchParams.get('url'));
      else if (url.pathname === '/ai/recipe' && req.method === 'POST') res = await aiRecipe(req, env);
      else res = json({ error: 'not-found' }, 404);
      return withHeaders(res, cors);
    } catch (e) {
      console.error(e);
      return withHeaders(json({ error: String((e && e.message) || e) }, 500), cors);
    }
  }
};

/* ───────────── helpers ───────────── */

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  const ok = allowed.includes('*') || allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin || '*' : allowed[0],
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Cookbook-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function withHeaders(res, extra) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

/* ───────────── gist storage ───────────── */

function gh(env, path, init = {}) {
  if (!env.GIST_TOKEN) throw new Error('GIST_TOKEN secret is not set');
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GIST_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cookbook-relay',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {})
    }
  });
}

async function readGist(env) {
  const r = await gh(env, `/gists/${env.GIST_ID}`);
  if (!r.ok) throw new Error(`gist-read-${r.status}`);
  const g = await r.json();
  const out = {};
  for (const name of FILES) {
    const f = g.files[name];
    if (!f) continue;
    let content = f.content;
    if (f.truncated) {
      // the API inlines at most ~1 MB per file; larger files must be read from raw_url
      const rr = await fetch(f.raw_url, { headers: { Authorization: `Bearer ${env.GIST_TOKEN}`, 'User-Agent': 'cookbook-relay' } });
      content = await rr.text();
    }
    try {
      out[name] = JSON.parse(content);
    } catch {
      out[name] = null;
    }
  }
  return out;
}

function normaliseRecipes(list) {
  return (Array.isArray(list) ? list : []).map((r) => {
    if (r && r.updatedAt == null && r.tv != null) {
      const { tv, ...rest } = r;
      return { ...rest, updatedAt: tv };
    }
    return r;
  });
}

async function loadData(env) {
  const f = await readGist(env);
  const plan = f['plan.json'] || {};
  const shop = f['shopping.json'] || {};
  return {
    recipes: normaliseRecipes(f['recipes.json']),
    ratings: f['ratings.json'] || {},
    plan: { slots: plan.slots || {} },
    shopping: { checks: shop.checks || {}, extras: shop.extras || {}, pantry: shop.pantry || {} }
  };
}

// ── last-write-wins merge (same rules as src/lib/merge.ts) ──
const ts = (r) => (r && (r.updatedAt || r.tv)) || 0;
function mergeRecipes(base, incoming) {
  const byId = new Map(base.map((r) => [r.id, r]));
  for (const r of incoming || []) {
    if (!r || typeof r.id !== 'number') continue;
    const cur = byId.get(r.id);
    if (!cur || ts(r) >= ts(cur)) byId.set(r.id, r);
  }
  return [...byId.values()];
}
function mergeMap(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    if (!v || typeof v !== 'object') continue;
    const cur = out[k];
    if (!cur || (v.t || 0) >= (cur.t || 0)) out[k] = v;
  }
  return out;
}

async function postData(req, env) {
  if (env.WRITE_KEY && req.headers.get('X-Cookbook-Key') !== env.WRITE_KEY) return json({ error: 'forbidden' }, 403);
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) return json({ error: 'too-large' }, 413);
  const delta = await req.json();
  const cur = await loadData(env);
  const next = {
    recipes: delta.recipes ? mergeRecipes(cur.recipes, delta.recipes) : cur.recipes,
    ratings: delta.ratings ? mergeMap(cur.ratings, delta.ratings) : cur.ratings,
    plan: { slots: delta.plan ? mergeMap(cur.plan.slots, delta.plan) : cur.plan.slots },
    shopping: {
      checks: delta.checks ? mergeMap(cur.shopping.checks, delta.checks) : cur.shopping.checks,
      extras: delta.extras ? mergeMap(cur.shopping.extras, delta.extras) : cur.shopping.extras,
      pantry: delta.pantry ? mergeMap(cur.shopping.pantry, delta.pantry) : cur.shopping.pantry
    }
  };
  // prune: plan entries older than 120 days, ticked items older than 60 days
  const cutoff = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
  for (const k of Object.keys(next.plan.slots)) if (k.split('|')[0] < cutoff) delete next.plan.slots[k];
  const oldTick = Date.now() - 60 * 864e5;
  for (const [k, v] of Object.entries(next.shopping.checks)) if ((v.t || 0) < oldTick) delete next.shopping.checks[k];
  for (const [k, v] of Object.entries(next.shopping.extras)) if (v.deleted && (v.t || 0) < oldTick) delete next.shopping.extras[k];

  const files = {};
  if (delta.recipes) files['recipes.json'] = { content: JSON.stringify(next.recipes, null, 1) };
  if (delta.ratings) files['ratings.json'] = { content: JSON.stringify(next.ratings, null, 1) };
  if (delta.plan) files['plan.json'] = { content: JSON.stringify(next.plan, null, 1) };
  if (delta.checks || delta.extras || delta.pantry) files['shopping.json'] = { content: JSON.stringify(next.shopping, null, 1) };
  if (Object.keys(files).length) {
    const w = await gh(env, `/gists/${env.GIST_ID}`, { method: 'PATCH', body: JSON.stringify({ files }), headers: { 'Content-Type': 'application/json' } });
    if (!w.ok) throw new Error(`gist-write-${w.status}`);
  }
  return json(next);
}

/* ───────────── import from a link ───────────── */

async function extract(target) {
  if (!target) return json({ error: 'missing-url' }, 400);
  let u;
  try {
    u = new URL(target);
  } catch {
    return json({ error: 'bad-url' }, 400);
  }
  if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(u.hostname)) return json({ error: 'bad-url' }, 400);
  const r = await fetch(u.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
    },
    redirect: 'follow',
    cf: { cacheTtl: 3600 }
  });
  if (!r.ok) return json({ error: `fetch-${r.status}` }, 502);
  const html = (await r.text()).slice(0, 3_000_000);
  const jsonld = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      jsonld.push(JSON.parse(m[1].trim()));
    } catch {
      /* ignore broken blocks */
    }
  }
  const meta = (p) => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, 'i')) || [])[1];
  // plain text fallback for sites without structured data
  const text = html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .slice(0, 20000);
  return json({ jsonld, title: meta('og:title'), image: meta('og:image'), html: text });
}

/* ───────────── AI clean-up & translation ───────────── */

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const SYSTEM = `You are the editor of a family cookbook used by a French/British family living in Singapore.
You receive one recipe (title, ingredients, directions, notes) in any language.
Return ONLY a JSON object: {"lang":"fr"|"en","fr":R,"en":R${'${VI}'}} where R = {"title":string,"ingredients":string[],"directions":string,"notes":string}.
Rules:
- "lang" = the language the recipe was written in.
- "fr" is natural, idiomatic French (France). "en" is natural Australian English (zucchini, eggplant, capsicum, coriander, spring onions, prawns, rocket, plain flour, caster sugar, icing sugar, cornflour, thickened cream, bicarb soda, mince, canola oil, chilli, stovetop, grill, baking tray, cling wrap; spelling: colour, flavour, centre).
- Metric only: grams, kg, ml, cl, litres, °C, cm. Convert cups, oz, lb, fl oz, sticks, °F and inches. Keep teaspoon/tablespoon (FR: c. à c. / c. à s.; EN: tsp / tbsp. French text must contain no English words).
- Ingredients: one per line, format "<quantity> <unit> <ingredient>, <preparation>" e.g. "200 g plain flour", "2 courgettes, diced", "1 tbsp olive oil".
  Use the plain, standard shop name of the ingredient (e.g. "spring onions" never "scallions"/"green onions"; "oignons verts" never "cébettes"/"oignons nouveaux"; "chicken breast"/"blancs de poulet"). Put preparation after the comma, never inside the name.
- Keep every ingredient and every step; do not invent or drop anything; keep quantities identical after conversion.
- "directions": one step per line separated by "\\n", no numbering.
- Fix obvious typos. Keep it concise.`;

async function aiRecipe(req, env) {
  if (!env.AI) return json({ error: 'ai-unavailable' }, 503);
  const { recipe, visaya } = await req.json();
  if (!recipe || !recipe.title) return json({ error: 'missing-recipe' }, 400);
  const vi = visaya ? ',"vi":R' : '';
  const sys = SYSTEM.replace('${VI}', vi) + (visaya ? '\n- "vi" is Cebuano (Visaya) as spoken in the Philippines, simple everyday words.' : '');
  const input = JSON.stringify({
    title: recipe.title,
    ingredients: (recipe.ingredients || []).slice(0, 80),
    directions: String(recipe.directions || '').slice(0, 8000),
    notes: String(recipe.notes || '').slice(0, 2000)
  });
  const out = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: input }
    ],
    max_tokens: 6000,
    temperature: 0.2,
    response_format: { type: 'json_object' }
  });
  const raw = typeof out.response === 'string' ? out.response : JSON.stringify(out.response);
  const parsed = parseJsonLoose(raw);
  if (!parsed || !parsed.fr || !parsed.en) return json({ error: 'ai-bad-output' }, 502);
  return json(parsed);
}

function parseJsonLoose(s) {
  try {
    return JSON.parse(s);
  } catch {
    const m = s && s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}
