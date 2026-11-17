import { useMemo, useState } from 'react';
import { useStore, setCheck, setChecks, upsertExtra, setPantry, setPrefs } from '../lib/store';
import { DEFAULT_STAPLES, stapleLabel, redmartMatch, redmartUrl, redmartSearchUrl } from '../data/redmart';
import { buildShoppingList, parseServings, textFor, AISLE_ORDER, AISLE_EMOJI, aisleOf, type ShopLine, type Aisle } from '../lib/ingredients';
import { iso, addDays, mondayOf } from '../lib/plan';
import { go } from '../lib/router';
import { Icon, toast, useT } from '../components/ui';

type Range = 'week' | 'next7' | 'next14';

export function ShopView() {
  const t = useT();
  const data = useStore((s) => s.data);
  const prefs = useStore((s) => s.prefs);
  const [range, setRange] = useState<Range>(() => (localStorage.getItem('cb_shop_range') as Range) || 'next7');
  const [newItem, setNewItem] = useState('');
  const [openDetails, setOpenDetails] = useState<string | null>(null);
  const [editStaples, setEditStaples] = useState(false);
  const [newStaple, setNewStaple] = useState('');
  const rm = prefs.redmart;

  const { from, to } = useMemo(() => {
    const today = new Date();
    if (range === 'week') return { from: iso(mondayOf(today)), to: iso(addDays(mondayOf(today), 7)) };
    return { from: iso(today), to: iso(addDays(today, range === 'next7' ? 7 : 14)) };
  }, [range]);

  const sources = useMemo(() => {
    const byId = new Map(data.recipes.map((r) => [r.id, r]));
    const out: { recipe: (typeof data.recipes)[number]; ratio: number; title: string }[] = [];
    for (const [k, e] of Object.entries(data.plan.slots)) {
      const day = k.split('|')[0];
      if (e.deleted || day < from || day >= to) continue;
      const r = byId.get(e.id);
      if (!r || r.deleted) continue;
      const base = parseServings(r.servings);
      out.push({ recipe: r, ratio: base ? e.servings / base : 1, title: textFor(r, prefs.lang).title });
    }
    return out;
  }, [data.plan, data.recipes, from, to, prefs.lang]);

  const lines = useMemo(() => buildShoppingList(sources, prefs.lang), [sources, prefs.lang]);

  // a line's check is keyed by ingredient + period so next week's list starts fresh
  const ck = (key: string) => `${from}:${key}`;
  const isChecked = (key: string) => !!data.shopping.checks[ck(key)]?.checked;
  const inPantry = (l: ShopLine) => {
    const p = data.shopping.pantry[l.key];
    return p ? p.on : l.staple;
  };

  const main = lines.filter((l) => !inPantry(l));
  const pantry = lines.filter((l) => inPantry(l));
  const extras = Object.values(data.shopping.extras).filter((e) => !e.deleted);

  // staples: defaults + family additions, minus removals (synced via the pantry map, keys "staple:<name>")
  const staples = useMemo(() => {
    const set = new Map<string, boolean>(DEFAULT_STAPLES.map((n) => [n, true]));
    for (const [k, v] of Object.entries(data.shopping.pantry)) if (k.startsWith('staple:')) set.set(k.slice(7), v.on);
    return [...set].filter(([, on]) => on).map(([n]) => n);
  }, [data.shopping.pantry]);
  const hasExtra = (name: string) => extras.find((e) => e.text.toLowerCase() === name.toLowerCase());
  const toggleStaple = (name: string) => {
    const label = stapleLabel(name, prefs.lang);
    const ex = hasExtra(label);
    if (ex) upsertExtra({ ...ex, deleted: true });
    else upsertExtra({ id: `x${Date.now().toString(36)}`, text: label, checked: false });
  };

  const groups = AISLE_ORDER.map((a) => ({ aisle: a, items: main.filter((l) => l.aisle === a) })).filter((g) => g.items.length);
  const total = main.length + extras.length;
  const done = main.filter((l) => isChecked(l.key)).length + extras.filter((e) => e.checked).length;

  const asText = () => {
    const out: string[] = [];
    for (const g of groups) {
      out.push(`${AISLE_EMOJI[g.aisle]} ${t[`aisle_${g.aisle}` as const]}`);
      for (const l of g.items) if (!isChecked(l.key)) out.push(`- ${l.label}${l.amounts.length ? ` — ${l.amounts.join(' + ')}` : ''}`);
    }
    const ex = extras.filter((e) => !e.checked);
    if (ex.length) {
      out.push(`✍️ ${t.aisle_extra}`);
      ex.forEach((e) => out.push(`- ${e.text}`));
    }
    return out.join('\n');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText());
      toast(t.copied);
    } catch {
      /* ignore */
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t.shopTitle, text: asText() });
      } catch {
        /* cancelled */
      }
    } else copy();
  };

  const addExtra = () => {
    const text = newItem.trim();
    if (!text) return;
    upsertExtra({ id: `x${Date.now().toString(36)}`, text, checked: false });
    setNewItem('');
  };

  const uncheckAll = () => {
    setChecks(main.map((l) => ck(l.key)), false);
    extras.filter((e) => e.checked).forEach((e) => upsertExtra({ ...e, checked: false }));
  };

  return (
    <div className="page shop-page" data-testid="shopping-list">
      <header className="page-head">
        <div className="title-row">
          <h1>{t.shopTitle}</h1>
          <div className="row-gap">
            <button className="icon-btn" onClick={copy} aria-label={t.copyList} title={t.copyList}><Icon name="copy" /></button>
            <button className="icon-btn" onClick={share} aria-label={t.shareList} title={t.shareList}><Icon name="share" /></button>
          </div>
        </div>
        <div className="chips scroll-x">
          {(['next7', 'week', 'next14'] as Range[]).map((r) => (
            <button key={r} className={'chip' + (range === r ? ' on' : '')} onClick={() => { setRange(r); localStorage.setItem('cb_shop_range', r); }}>
              {r === 'week' ? t.shopRangeWeek : r === 'next7' ? t.shopRangeNext : t.shopRange2}
            </button>
          ))}
          <span className="chip-sep" />
          <button className={'chip' + (rm ? ' on' : '')} onClick={() => setPrefs({ redmart: !rm })}>🛒 {t.redmartBeta}</button>
        </div>
        {total > 0 && (
          <div className="progress-row">
            <div className="progress"><span style={{ width: `${(done / total) * 100}%` }} /></div>
            <span className="small muted">{t.checkedCount(done, total)}</span>
            {done > 0 && <button className="link-btn small" onClick={uncheckAll}>{t.uncheckAll}</button>}
          </div>
        )}
        {sources.length > 0 && (
          <p className="small muted for-line">
            {t.forRecipes} {[...new Set(sources.map((s) => s.title))].join(' · ')}
          </p>
        )}
      </header>

      <div className="add-item">
        <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addExtra()} placeholder={t.addItem} aria-label={t.addItem} />
        <button className="icon-btn accent" onClick={addExtra} aria-label={t.addItem}><Icon name="plus" /></button>
      </div>

      <section className="aisle staples">
        <div className="row-between">
          <h2>🧺 {t.staples}</h2>
          <button className="link-btn small" onClick={() => setEditStaples(!editStaples)}>{editStaples ? t.staplesDone : t.staplesEdit}</button>
        </div>
        <div className="chips wrap">
          {staples.map((n) => {
            const label = stapleLabel(n, prefs.lang);
            const on = !!hasExtra(label);
            return editStaples ? (
              <button key={n} className="chip" onClick={() => setPantry(`staple:${n}`, false)}><Icon name="close" size={12} /> {label}</button>
            ) : (
              <button key={n} className={'chip' + (on ? ' on' : '')} onClick={() => toggleStaple(n)}><Icon name={on ? 'check' : 'plus'} size={12} /> {label}</button>
            );
          })}
        </div>
        {editStaples && (
          <div className="add-item">
            <input value={newStaple} onChange={(e) => setNewStaple(e.target.value)} placeholder={t.staplesAdd} onKeyDown={(e) => { if (e.key === 'Enter' && newStaple.trim()) { setPantry(`staple:${newStaple.trim()}`, true); setNewStaple(''); } }} />
            <button className="icon-btn accent" aria-label={t.staplesAdd} onClick={() => { if (newStaple.trim()) { setPantry(`staple:${newStaple.trim()}`, true); setNewStaple(''); } }}><Icon name="plus" /></button>
          </div>
        )}
      </section>

      {total === 0 && pantry.length === 0 ? (
        <div className="empty">
          <div className="empty-emoji">🛒</div>
          <h3>{t.shopEmpty}</h3>
          <p className="muted">{t.shopEmptyHint}</p>
          <button className="btn primary" onClick={() => go('plan')}><Icon name="calendar" size={18} /> {t.planTitle}</button>
        </div>
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.aisle} className="aisle">
              <h2>{AISLE_EMOJI[g.aisle]} {t[`aisle_${g.aisle}` as const]}</h2>
              <ul className="shop-list">
                {g.items.map((l) => (
                  <ShopItem
                    key={l.key}
                    line={l}
                    checked={isChecked(l.key)}
                    onToggle={() => setCheck(ck(l.key), !isChecked(l.key))}
                    expanded={openDetails === l.key}
                    onExpand={() => setOpenDetails(openDetails === l.key ? null : l.key)}
                    onPantry={() => setPantry(l.key, true)}
                    pantryLabel={t.alwaysHave}
                    redmart={rm}
                  />
                ))}
              </ul>
            </section>
          ))}

          {extras.length > 0 && (
            <section className="aisle">
              <h2>✍️ {t.aisle_extra}</h2>
              <ul className="shop-list">
                {extras.map((e) => (
                  <li key={e.id} className={'shop-item' + (e.checked ? ' done' : '')}>
                    <button className="check" onClick={() => upsertExtra({ ...e, checked: !e.checked })} aria-pressed={e.checked}>
                      {e.checked && <Icon name="check" size={14} />}
                    </button>
                    <span className="shop-text" onClick={() => upsertExtra({ ...e, checked: !e.checked })}>
                      <span className="shop-label">{e.text}</span>
                      <span className="small muted">{AISLE_EMOJI[aisleOf(e.text.toLowerCase()) as Aisle]}</span>
                    </span>
                    {rm && <RedmartLink text={e.text} />}
                    <button className="icon-btn sm" onClick={() => upsertExtra({ ...e, deleted: true })} aria-label={t.remove}><Icon name="close" size={16} /></button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {pantry.length > 0 && (
            <section className="aisle pantry">
              <h2>🧺 {t.pantry}</h2>
              <p className="small muted">{t.pantryHint}</p>
              <div className="chips wrap">
                {pantry.map((l) => (
                  <button key={l.key} className="chip" onClick={() => setPantry(l.key, false)} title={l.details.join('\n')}>
                    <Icon name="plus" size={12} /> {l.label}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function RedmartLink({ text }: { text: string }) {
  const t = useT();
  const p = redmartMatch(text);
  return (
    <a className={'rm-link' + (p ? ' known' : '')} href={p ? redmartUrl(p) : redmartSearchUrl(text)} target="_blank" rel="noreferrer" title={p ? `${t.redmartBought} ${p.n}` : t.redmartSearch} aria-label={p ? `${t.redmartBought} ${p.n}` : t.redmartSearch} onClick={(e) => e.stopPropagation()}>
      {p ? '🛒' : '🔍'}
    </a>
  );
}

function ShopItem({ line, checked, onToggle, expanded, onExpand, onPantry, pantryLabel, redmart }: {
  line: ShopLine; checked: boolean; onToggle: () => void; expanded: boolean; onExpand: () => void; onPantry: () => void; pantryLabel: string; redmart: boolean;
}) {
  const t = useT();
  const product = redmart ? redmartMatch(`${line.label} ${line.key}`) : null;
  return (
    <li className={'shop-item' + (checked ? ' done' : '')}>
      <button className="check" onClick={onToggle} aria-pressed={checked} aria-label={line.label}>
        {checked && <Icon name="check" size={14} />}
      </button>
      <span className="shop-text" onClick={onToggle}>
        <span className="shop-label">{line.label}</span>
        {line.amounts.length > 0 && <span className="shop-qty">{line.amounts.join(' + ')}</span>}
      </span>
      {redmart && <RedmartLink text={`${line.label} ${line.key}`} />}
      <button className="icon-btn sm" onClick={onExpand} aria-label="details" aria-expanded={expanded}>
        <Icon name="more" size={16} />
      </button>
      {expanded && (
        <div className="shop-details">
          {product && (
            <a className="small rm-product" href={redmartUrl(product)} target="_blank" rel="noreferrer">🛒 {t.redmartBought} {product.n}{product.size ? ` · ${product.size}` : ''}</a>
          )}
          {line.details.map((d, i) => (
            <div key={i} className="small muted">• {d}</div>
          ))}
          <button className="link-btn small" onClick={onPantry}>🧺 {pantryLabel}</button>
        </div>
      )}
    </li>
  );
}
