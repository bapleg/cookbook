import { useMemo, useState } from 'react';
import { useStore, setSlot, setSlots, setPrefs, visibleRecipes } from '../lib/store';
import { textFor, totalMinutes, fmtMinutes } from '../lib/ingredients';
import { iso, addDays, mondayOf, slotKey, dayLabel, suggest, avgRating, lastPlanned, isComplete, defaultServings } from '../lib/plan';
import { go } from '../lib/router';
import { Icon, Photo, Sheet, Stepper, toast, useT } from '../components/ui';
import type { MealSlot, Recipe } from '../lib/types';

export function PlanView() {
  const t = useT();
  const data = useStore((s) => s.data);
  const prefs = useStore((s) => s.prefs);
  const [weekOffset, setWeekOffset] = useState(0);
  const [picker, setPicker] = useState<{ key: string } | null>(null);
  const [menu, setMenu] = useState<{ key: string } | null>(null);

  const start = addDays(mondayOf(new Date()), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = iso(new Date());
  const slots: MealSlot[] = prefs.showLunch ? ['lunch', 'dinner'] : ['dinner'];
  const byId = useMemo(() => new Map(data.recipes.map((r) => [r.id, r])), [data.recipes]);

  const entry = (key: string) => {
    const e = data.plan.slots[key];
    return e && !e.deleted && byId.get(e.id) && !byId.get(e.id)!.deleted ? e : null;
  };

  const weekKeys = days.flatMap((d) => slots.map((s) => slotKey(iso(d), s)));
  const plannedCount = weekKeys.filter((k) => entry(k)).length;

  const autofill = () => {
    const empty = days.filter((d) => iso(d) >= today).map((d) => slotKey(iso(d), 'dinner')).filter((k) => !entry(k));
    if (!empty.length) return;
    const exclude = new Set(weekKeys.map((k) => entry(k)?.id).filter(Boolean) as number[]);
    const picks = suggest(data, prefs.favs, exclude, today, empty.length);
    const upd: Record<string, { id: number; servings: number }> = {};
    empty.forEach((k, i) => {
      const r = picks[i];
      if (r) upd[k] = { id: r.id, servings: defaultServings(r, prefs.householdServings) };
    });
    setSlots(upd);
    toast(`${Object.keys(upd).length} ✓`);
  };

  const copyLastWeek = () => {
    const upd: Record<string, { id: number; servings: number }> = {};
    days.forEach((d) => {
      const prev = iso(addDays(d, -7));
      (['lunch', 'dinner'] as MealSlot[]).forEach((s) => {
        const e = entry(slotKey(prev, s));
        if (e && !entry(slotKey(iso(d), s)) && iso(d) >= today) upd[slotKey(iso(d), s)] = { id: e.id, servings: e.servings };
      });
    });
    setSlots(upd);
    toast(`${Object.keys(upd).length} ✓`);
  };

  const clearWeek = () => {
    if (!confirm(t.clearWeekConfirm)) return;
    const upd: Record<string, null> = {};
    weekKeys.filter((k) => entry(k) && k >= today).forEach((k) => (upd[k] = null));
    setSlots(upd);
  };

  const lbl0 = dayLabel(start, prefs.lang);
  const lbl6 = dayLabel(days[6], prefs.lang);

  return (
    <div className="page">
      <header className="page-head">
        <div className="title-row">
          <h1>{t.planTitle}</h1>
          <button className="btn sm" onClick={() => go('shop')}>
            <Icon name="cart" size={16} /> {t.shopTitle}
          </button>
        </div>
        <div className="week-nav">
          <button className="icon-btn" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="‹"><Icon name="chevronL" /></button>
          <button className="week-label" onClick={() => setWeekOffset(0)}>
            {weekOffset === 0 ? t.thisWeek : `${lbl0.num} ${lbl0.month} – ${lbl6.num} ${lbl6.month}`}
          </button>
          <button className="icon-btn" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="›"><Icon name="chevronR" /></button>
        </div>
        <div className="chips scroll-x">
          <button className="chip accent" onClick={autofill} title={t.autofillHint}>
            <Icon name="sparkle" size={14} /> {t.autofill}
          </button>
          <button className="chip" onClick={copyLastWeek}>
            <Icon name="copy" size={14} /> {t.copyLastWeek}
          </button>
          <button className={'chip' + (prefs.showLunch ? ' on' : '')} onClick={() => setPrefs({ showLunch: !prefs.showLunch })}>
            {t.showLunch}
          </button>
          {plannedCount > 0 && (
            <button className="chip" onClick={clearWeek}>
              <Icon name="trash" size={14} /> {t.clearWeek}
            </button>
          )}
        </div>
      </header>

      {plannedCount === 0 && (
        <div className="hint-card">
          <b>{t.planEmpty}</b>
          <span className="muted small">{t.planEmptyHint}</span>
        </div>
      )}

      <div className="week">
        {days.map((d) => {
          const day = iso(d);
          const lbl = dayLabel(d, prefs.lang);
          const past = day < today;
          return (
            <div key={day} className={'day' + (day === today ? ' today' : '') + (past ? ' past' : '')}>
              <div className="day-label">
                <span className="dow">{lbl.short}</span>
                <span className="dnum">{lbl.num}</span>
              </div>
              <div className="day-slots">
                {slots.map((s) => {
                  const key = slotKey(day, s);
                  const e = entry(key);
                  const r = e ? byId.get(e.id)! : null;
                  return (
                    <div key={s} className="slot">
                      {prefs.showLunch && <span className="slot-name">{s === 'lunch' ? t.lunch : t.dinner}</span>}
                      {r && e ? (
                        <div className="meal" onClick={() => setMenu({ key })}>
                          <Photo src={r.photo} emoji={r.emoji} className="meal-img" />
                          <div className="meal-body">
                            <b>{textFor(r, prefs.lang).title}</b>
                            <span className="muted small">
                              {e.servings} {t.people}
                              {totalMinutes(r) ? ` · ${fmtMinutes(totalMinutes(r))}` : ''}
                            </span>
                          </div>
                          <Icon name="more" size={18} />
                        </div>
                      ) : (
                        <button className="meal-add" disabled={past} onClick={() => setPicker({ key })}>
                          <Icon name="plus" size={16} /> {t.addMeal}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <RecipePicker
        open={!!picker}
        onClose={() => setPicker(null)}
        exclude={new Set(weekKeys.map((k) => entry(k)?.id).filter(Boolean) as number[])}
        onPick={(r) => {
          if (picker) setSlot(picker.key, { id: r.id, servings: defaultServings(r, prefs.householdServings) });
          setPicker(null);
        }}
      />

      {menu && (() => {
        const e = entry(menu.key);
        const r = e ? byId.get(e.id) : null;
        if (!e || !r) return null;
        return (
          <Sheet open onClose={() => setMenu(null)} title={textFor(r, prefs.lang).title}>
            <div className="menu-sheet">
              <div className="row-between">
                <span>{t.servings}</span>
                <Stepper value={e.servings} onChange={(n) => setSlot(menu.key, { id: e.id, servings: n })} />
              </div>
              <button className="btn block" onClick={() => { setMenu(null); go(`r/${r.id}`); }}>
                <Icon name="book" size={18} /> {t.navRecipes}
              </button>
              <button className="btn block" onClick={() => { const k = menu.key; setMenu(null); setPicker({ key: k }); }}>
                <Icon name="refresh" size={18} /> {t.change}
              </button>
              <button className="btn block danger" onClick={() => { setSlot(menu.key, null); setMenu(null); }}>
                <Icon name="trash" size={18} /> {t.remove}
              </button>
            </div>
          </Sheet>
        );
      })()}
    </div>
  );
}

function RecipePicker({ open, onClose, onPick, exclude }: { open: boolean; onClose: () => void; onPick: (r: Recipe) => void; exclude: Set<number> }) {
  const t = useT();
  const data = useStore((s) => s.data);
  const prefs = useStore((s) => s.prefs);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'sugg' | 'fav' | 'top' | 'quick'>('sugg');
  const today = iso(new Date());

  const lists = useMemo(() => {
    if (!open) return { sugg: [], fav: [], top: [], quick: [], all: [] as Recipe[] };
    const all = visibleRecipes(data).filter(isComplete);
    const last = lastPlanned(data);
    return {
      sugg: suggest(data, prefs.favs, exclude, today, 12),
      fav: all.filter((r) => prefs.favs.includes(r.id)),
      top: [...all].filter((r) => avgRating(data.ratings[String(r.id)]) > 0).sort((a, b) => avgRating(data.ratings[String(b.id)]) - avgRating(data.ratings[String(a.id)])),
      quick: all.filter((r) => (totalMinutes(r) || 999) <= 30).sort((a, b) => (last.get(a.id) || '').localeCompare(last.get(b.id) || '')),
      all
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data, prefs.favs]);

  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const shown = q
    ? lists.all.filter((r) => fold(textFor(r, prefs.lang).title + ' ' + (r.fr?.ingredients || []).join(' ')).includes(fold(q)))
    : lists[tab];

  return (
    <Sheet open={open} onClose={onClose} title={t.pickRecipe}>
      <div className="search">
        <Icon name="search" size={18} />
        <input type="search" value={q} placeholder={t.search} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!q && (
        <div className="chips scroll-x">
          {([
            ['sugg', t.suggestions],
            ['fav', t.favouritesShort],
            ['top', t.topRated],
            ['quick', t.quick]
          ] as const).map(([k, l]) => (
            <button key={k} className={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
      )}
      <div className="pick-list">
        {shown.length === 0 && <p className="muted center">{t.noResults}</p>}
        {shown.map((r) => {
          const avg = avgRating(data.ratings[String(r.id)]);
          const m = totalMinutes(r);
          return (
            <button key={r.id} className="pick-item" onClick={() => onPick(r)}>
              <Photo src={r.photo} emoji={r.emoji} className="pick-img" />
              <span className="pick-text">
                <b>{textFor(r, prefs.lang).title}</b>
                <span className="muted small">
                  {[m ? fmtMinutes(m) : '', avg ? `★ ${avg.toFixed(1)}` : '', prefs.favs.includes(r.id) ? '♥' : ''].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
