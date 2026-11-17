import { useMemo, useState } from 'react';
import { useStore, setCheck, setChecks, upsertExtra, setPantry, setPrefs, setRedmartLink } from '../lib/store';
import { DEFAULT_STAPLES, stapleLabel, redmartMatch, redmartUrl, redmartSearchUrl } from '../data/redmart';
import { buildShoppingList, parseServings, textFor, AISLE_ORDER, AISLE_EMOJI, aisleOf, type ShopLine, type Aisle } from '../lib/ingredients';
import { iso, addDays, mondayOf } from '../lib/plan';
import { go } from '../lib/router';
import { Icon, Sheet, toast, useT } from '../components/ui';

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
  const [cartOpen, setCartOpen] = useState(false);

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

  // RedMart: product for a line = custom link (synced) > product bought before > search
  const resolve = (key: string, text: string, label = text): RmTarget => {
    const custom = data.shopping.pantry[`rm:${key}`];
    if (custom?.on && custom.url) return { url: custom.url, name: t.rmCustom, kind: 'custom' };
    const p = redmartMatch(text);
    if (p) return { url: redmartUrl(p), name: p.n + (p.size ? ` · ${p.size}` : ''), kind: 'known' };
    return { url: redmartSearchUrl(label), name: `${t.rmSearchFor} ${label}`, kind: 'search' };
  };
  const cartItems: CartItem[] = [
    ...main.filter((l) => !isChecked(l.key)).map((l) => ({ key: l.key, label: l.label, qty: l.amounts.join(' + '), target: resolve(l.key, `${l.label} ${l.key}`, l.label), tick: () => setCheck(ck(l.key), true) })),
    ...extras.filter((e) => !e.checked).map((e) => ({ key: `x:${e.text.toLowerCase()}`, label: e.text, qty: '', target: resolve(`x:${e.text.toLowerCase()}`, e.text), tick: () => upsertExtra({ ...e, checked: true }) }))
  ];
  const offKey = (key: string) => `rmoff:${from}:${key}`;
  const isSelected = (key: string) => !data.shopping.pantry[offKey(key)]?.on;

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
        {rm && cartItems.length > 0 && (
          <button className="btn primary rm-cart-btn" data-testid="rm-cart-open" onClick={() => setCartOpen(true)}>
            🛒 {t.rmCart} · {cartItems.filter((i) => isSelected(i.key)).length}
          </button>
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
                    target={rm ? resolve(l.key, `${l.label} ${l.key}`, l.label) : null}
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
                    {rm && <RedmartLink target={resolve(`x:${e.text.toLowerCase()}`, e.text)} />}
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
      <RedmartCart
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        isSelected={isSelected}
        setSelected={(key, on) => setPantry(offKey(key), !on)}
      />
    </div>
  );
}

interface RmTarget { url: string; name: string; kind: 'custom' | 'known' | 'search' }
interface CartItem { key: string; label: string; qty: string; target: RmTarget; tick: () => void }

function RedmartCart({ open, onClose, items, isSelected, setSelected }: {
  open: boolean; onClose: () => void; items: CartItem[]; isSelected: (key: string) => boolean; setSelected: (key: string, on: boolean) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [next, setNext] = useState(0);
  const sel = items.filter((i) => isSelected(i.key));
  const allOn = sel.length === items.length;

  const save = (key: string) => {
    const url = draft.trim();
    if (url && !/^https:\/\//i.test(url)) return toast(t.rmBadUrl);
    setRedmartLink(key, url);
    setEditing(null);
  };
  // browsers only allow one new tab per tap, so products open one tap at a time
  const openNext = () => {
    const i = next >= sel.length ? 0 : next;
    window.open(sel[i].target.url, '_blank', 'noopener');
    setNext(i + 1);
  };
  const copy = async () => {
    const text = sel.map((i) => `- ${i.label}${i.qty ? ` — ${i.qty}` : ''} → ${i.target.url}`).join('\n');
    try { await navigator.clipboard.writeText(text); toast(t.copied); } catch { toast(text); }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`🛒 ${t.rmCart} (${sel.length}/${items.length})`}
      footer={
        <div className="rm-foot">
          <button className="btn primary" disabled={!sel.length} onClick={openNext}>
            {next > 0 && next < sel.length ? t.rmOpenNext(next + 1, sel.length) : t.rmOpen(sel.length)}
          </button>
          <button className="btn" disabled={!sel.length} onClick={copy}>{t.rmCopy}</button>
          <button className="btn" disabled={!sel.length} onClick={() => { sel.forEach((i) => i.tick()); onClose(); }}>{t.rmMarkBought}</button>
        </div>
      }
    >
      <p className="small muted">{t.rmCartHint}</p>
      <button className="link-btn" data-testid="rm-select-all" onClick={() => items.forEach((i) => isSelected(i.key) === allOn && setSelected(i.key, !allOn))}>
        {allOn ? t.rmSelectNone : t.rmSelectAll}
      </button>
      <ul className="shop-list rm-cart" data-testid="rm-cart">
        {items.map((i) => {
          const on = isSelected(i.key);
          return (
            <li key={i.key} className={'shop-item rm-item' + (on ? '' : ' off')} data-rm-item data-selected={on} data-label={i.label} data-qty={i.qty} data-url={i.target.url} data-kind={i.target.kind}>
              <button className={'check' + (on ? ' on' : '')} onClick={() => setSelected(i.key, !on)} aria-pressed={on} aria-label={i.label}>
                {on && <Icon name="check" size={14} />}
              </button>
              <span className="shop-text">
                <span className="shop-label">{i.label}{i.qty && <span className="shop-qty"> {i.qty}</span>}</span>
                <a className={'small rm-target rm-' + i.target.kind} href={i.target.url} target="_blank" rel="noreferrer">{i.target.kind === 'search' ? '🔍' : '🛒'} {i.target.name}</a>
              </span>
              <button className="icon-btn sm" aria-label={t.rmEdit} title={t.rmEdit} onClick={() => { setEditing(editing === i.key ? null : i.key); setDraft(i.target.kind === 'custom' ? i.target.url : ''); }}>
                <Icon name="edit" size={16} />
              </button>
              {editing === i.key && (
                <div className="shop-details rm-edit">
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.rmPaste} aria-label={t.rmPaste} inputMode="url" onKeyDown={(e) => e.key === 'Enter' && save(i.key)} />
                  <div className="row-gap">
                    <button className="btn primary sm" onClick={() => save(i.key)}>{t.rmSave}</button>
                    {i.target.kind === 'custom' && <button className="link-btn small" onClick={() => { setRedmartLink(i.key, ''); setEditing(null); }}>{t.rmReset}</button>}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

function RedmartLink({ target }: { target: RmTarget }) {
  return (
    <a className={'rm-link' + (target.kind === 'search' ? '' : ' known')} href={target.url} target="_blank" rel="noreferrer" title={target.name} aria-label={target.name} onClick={(e) => e.stopPropagation()}>
      {target.kind === 'search' ? '🔍' : '🛒'}
    </a>
  );
}

function ShopItem({ line, checked, onToggle, expanded, onExpand, onPantry, pantryLabel, target }: {
  line: ShopLine; checked: boolean; onToggle: () => void; expanded: boolean; onExpand: () => void; onPantry: () => void; pantryLabel: string; target: RmTarget | null;
}) {
  return (
    <li className={'shop-item' + (checked ? ' done' : '')}>
      <button className="check" onClick={onToggle} aria-pressed={checked} aria-label={line.label}>
        {checked && <Icon name="check" size={14} />}
      </button>
      <span className="shop-text" onClick={onToggle}>
        <span className="shop-label">{line.label}</span>
        {line.amounts.length > 0 && <span className="shop-qty">{line.amounts.join(' + ')}</span>}
      </span>
      {target && <RedmartLink target={target} />}
      <button className="icon-btn sm" onClick={onExpand} aria-label="details" aria-expanded={expanded}>
        <Icon name="more" size={16} />
      </button>
      {expanded && (
        <div className="shop-details">
          {target && target.kind !== 'search' && (
            <a className="small rm-product" href={target.url} target="_blank" rel="noreferrer">🛒 {target.name}</a>
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
