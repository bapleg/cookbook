import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, setSlot, setSlots, setPrefs, visibleRecipes } from '../lib/store';
import { textFor, totalMinutes, fmtMinutes } from '../lib/ingredients';
import { iso, addDays, mondayOf, slotKey, dayLabel, suggest, avgRating, lastPlanned, isComplete, defaultServings, mealsOn, keyDate, fromIso } from '../lib/plan';
import { go } from '../lib/router';
import { Icon, Photo, Sheet, Stepper, toast, useT } from '../components/ui';
import type { MealSlot, Recipe } from '../lib/types';

const MAX_PER_SLOT = 3;

export function PlanView() {
  const t = useT();
  const data = useStore((s) => s.data);
  const prefs = useStore((s) => s.prefs);
  const [weeksBefore, setWeeksBefore] = useState(0);
  const [weeksAfter, setWeeksAfter] = useState(4);
  const [picker, setPicker] = useState<{ day: string; slot: MealSlot; replace?: string } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const today = iso(new Date());
  const slots: MealSlot[] = prefs.showLunch ? ['lunch', 'dinner'] : ['dinner'];
  const byId = useMemo(() => new Map(data.recipes.map((r) => [r.id, r])), [data.recipes]);
  const monday0 = mondayOf(new Date());

  // infinite scroll: add two more weeks when the bottom comes into view
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setWeeksAfter((w) => Math.min(w + 2, 52));
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const weeks = Array.from({ length: weeksBefore + weeksAfter }, (_, i) => addDays(monday0, (i - weeksBefore) * 7));

  // ── drag & drop (pointer events: works with touch and mouse)
  const [drag, setDrag] = useState<{ key: string; x: number; y: number; over: string | null } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const scrollTimer = useRef<number | null>(null);
  const lastDrop = useRef(0);

  const dropTargetAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-drop]') as HTMLElement | null;
    return el?.dataset.drop || null;
  };
  const onGrip = (key: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ key, x: e.clientX, y: e.clientY, over: null });
    navigator.vibrate?.(15);
  };
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const over = dropTargetAt(e.clientX, e.clientY);
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, over } : d));
      // auto-scroll near the edges
      const edge = 90;
      const v = e.clientY < edge ? -14 : e.clientY > window.innerHeight - edge - 60 ? 14 : 0;
      if (scrollTimer.current) window.clearInterval(scrollTimer.current);
      scrollTimer.current = v ? window.setInterval(() => window.scrollBy(0, v), 16) : null;
    };
    const up = (e: PointerEvent) => {
      if (scrollTimer.current) window.clearInterval(scrollTimer.current);
      scrollTimer.current = null;
      const d = dragRef.current;
      setDrag(null);
      lastDrop.current = Date.now();
      if (!d) return;
      const target = dropTargetAt(e.clientX, e.clientY);
      const entry = data.plan.slots[d.key];
      if (!target || !entry) return;
      const [day, slot] = target.split('|') as [string, MealSlot];
      const [oldDay, oldSlot] = d.key.split('|');
      if (day === oldDay && slot === (oldSlot || 'dinner')) return;
      if (day < today) return;
      setSlots({ [d.key]: null, [slotKey(day, slot, entry.id)]: { id: entry.id, servings: entry.servings } });
      const l = dayLabel(fromIso(day), prefs.lang);
      toast(t.moved(`${l.short} ${l.num}`));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    document.body.classList.add('dragging');
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.classList.remove('dragging');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag]);

  // scroll to today on first open
  const todayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const weekActions = (start: Date) => {
    const days = Array.from({ length: 7 }, (_, i) => iso(addDays(start, i)));
    const weekMeals = days.flatMap((d) => (['lunch', 'dinner'] as MealSlot[]).flatMap((s) => mealsOn(data, d, s)));
    return {
      count: days.flatMap((d) => slots.flatMap((s) => mealsOn(data, d, s))).length,
      autofill: () => {
        const empty = days.filter((d) => d >= today && mealsOn(data, d, 'dinner').length === 0);
        if (!empty.length) return;
        const picks = suggest(data, prefs.favs, new Set(weekMeals.map((m) => m.id)), today, empty.length);
        const upd: Record<string, { id: number; servings: number }> = {};
        empty.forEach((d, i) => {
          const r = picks[i];
          if (r) upd[slotKey(d, 'dinner', r.id)] = { id: r.id, servings: defaultServings(r, prefs.householdServings) };
        });
        setSlots(upd);
        toast(`${Object.keys(upd).length} ✓`);
      },
      copyPrev: () => {
        const upd: Record<string, { id: number; servings: number }> = {};
        days.forEach((day) => {
          if (day < today) return;
          const prev = iso(addDays(fromIso(day), -7));
          (['lunch', 'dinner'] as MealSlot[]).forEach((s) => {
            const existing = new Set(mealsOn(data, day, s).map((m) => m.id));
            mealsOn(data, prev, s).forEach((m) => {
              if (!existing.has(m.id)) upd[slotKey(day, s, m.id)] = { id: m.id, servings: m.servings };
            });
          });
        });
        setSlots(upd);
        toast(`${Object.keys(upd).length} ✓`);
      },
      clear: () => {
        if (!confirm(t.clearWeekConfirm)) return;
        const upd: Record<string, null> = {};
        weekMeals.filter((m) => keyDate(m.key) >= today).forEach((m) => (upd[m.key] = null));
        setSlots(upd);
      }
    };
  };

  const menuEntry = menu ? data.plan.slots[menu] : null;
  const menuRecipe = menuEntry ? byId.get(menuEntry.id) : null;
  const draggedRecipe = drag ? byId.get(data.plan.slots[drag.key]?.id) : null;

  return (
    <div className="page">
      <header className="page-head">
        <div className="title-row">
          <h1>{t.planTitle}</h1>
          <button className="btn sm" onClick={() => go('shop')}>
            <Icon name="cart" size={16} /> {t.shopTitle}
          </button>
        </div>
        <div className="chips scroll-x">
          <button className={'chip' + (prefs.showLunch ? ' on' : '')} onClick={() => setPrefs({ showLunch: !prefs.showLunch })}>
            {t.showLunch}
          </button>
          <span className="small muted drag-hint">{t.dragHint}</span>
        </div>
      </header>

      <button className="btn sm earlier" onClick={() => setWeeksBefore(weeksBefore + 1)}>↑ {t.earlierWeeks}</button>

      {weeks.map((start) => {
        const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
        const a = weekActions(start);
        const l0 = dayLabel(start, prefs.lang);
        const isPast = iso(addDays(start, 6)) < today;
        return (
          <section key={iso(start)} className="week-block">
            <div className="week-head">
              <h2>{iso(start) === iso(monday0) ? t.thisWeek : t.weekOfShort(`${l0.num} ${l0.month}`)}</h2>
              {!isPast && (
                <div className="week-actions">
                  <button className="chip accent" onClick={a.autofill} title={t.autofillHint}><Icon name="sparkle" size={14} /> {t.autofill}</button>
                  <button className="chip" onClick={a.copyPrev} title={t.copyLastWeek} aria-label={t.copyLastWeek}><Icon name="copy" size={14} /></button>
                  {a.count > 0 && <button className="chip" onClick={a.clear} title={t.clearWeek} aria-label={t.clearWeek}><Icon name="trash" size={14} /></button>}
                </div>
              )}
            </div>
            <div className="week">
              {days.map((d) => {
                const day = iso(d);
                const lbl = dayLabel(d, prefs.lang);
                const past = day < today;
                return (
                  <div key={day} ref={day === today ? todayRef : undefined} className={'day' + (day === today ? ' today' : '') + (past ? ' past' : '')}>
                    <div className="day-label">
                      <span className="dow">{lbl.short}</span>
                      <span className="dnum">{lbl.num}</span>
                    </div>
                    <div className="day-slots">
                      {slots.map((s) => {
                        const meals = mealsOn(data, day, s);
                        const dropKey = `${day}|${s}`;
                        return (
                          <div key={s} className={'slot' + (drag && drag.over === dropKey && !past ? ' drop-over' : '')} data-drop={past ? undefined : dropKey}>
                            {prefs.showLunch && <span className="slot-name">{s === 'lunch' ? t.lunch : t.dinner}</span>}
                            {meals.map((m) => {
                              const r = byId.get(m.id)!;
                              const mins = totalMinutes(r);
                              return (
                                <div key={m.key} className={'meal' + (drag?.key === m.key ? ' dragging' : '')} onClick={() => !drag && Date.now() - lastDrop.current > 500 && setMenu(m.key)}>
                                  {!past && (
                                    <span className="grip" onPointerDown={onGrip(m.key)} aria-label="Déplacer" role="button" tabIndex={-1}>⋮⋮</span>
                                  )}
                                  <Photo src={r.photo} emoji={r.emoji} className="meal-img" cat={r.category} />
                                  <div className="meal-body">
                                    <b>{textFor(r, prefs.lang).title}</b>
                                    <span className="muted small">
                                      {m.servings} {t.people}
                                      {mins ? ` · ${fmtMinutes(mins)}` : ''}
                                    </span>
                                  </div>
                                  <Icon name="more" size={18} />
                                </div>
                              );
                            })}
                            {!past && meals.length < MAX_PER_SLOT && (
                              <button className={'meal-add' + (meals.length ? ' compact' : '')} onClick={() => setPicker({ day, slot: s })}>
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
          </section>
        );
      })}
      <div ref={sentinel} className="sentinel" />

      {drag && draggedRecipe && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          {draggedRecipe.emoji} {textFor(draggedRecipe, prefs.lang).title}
        </div>
      )}

      <RecipePicker
        open={!!picker}
        onClose={() => setPicker(null)}
        exclude={new Set()}
        onPick={(r) => {
          if (picker) {
            if (picker.replace) setSlot(picker.replace, null);
            setSlot(slotKey(picker.day, picker.slot, r.id), { id: r.id, servings: defaultServings(r, prefs.householdServings) });
          }
          setPicker(null);
        }}
      />

      {menu && menuEntry && menuRecipe && !menuEntry.deleted && (
        <Sheet open onClose={() => setMenu(null)} title={`${menuRecipe.emoji} ${textFor(menuRecipe, prefs.lang).title}`}>
          <div className="menu-sheet">
            <div className="row-between">
              <span>{t.servings}</span>
              <Stepper value={menuEntry.servings} onChange={(n) => setSlot(menu, { id: menuEntry.id, servings: n })} />
            </div>
            <button className="btn block" onClick={() => { setMenu(null); go(`r/${menuRecipe.id}`); }}>
              <Icon name="book" size={18} /> {t.navRecipes}
            </button>
            <button className="btn block" onClick={() => {
              const [day, slot] = menu.split('|');
              setMenu(null);
              setPicker({ day, slot: (slot || 'dinner') as MealSlot, replace: menu });
            }}>
              <Icon name="refresh" size={18} /> {t.change}
            </button>
            <button className="btn block danger" onClick={() => { setSlot(menu, null); setMenu(null); }}>
              <Icon name="trash" size={18} /> {t.remove}
            </button>
          </div>
        </Sheet>
      )}
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
  const shown = q ? lists.all.filter((r) => fold(textFor(r, prefs.lang).title + ' ' + (r.fr?.ingredients || []).join(' ')).includes(fold(q))) : lists[tab];

  return (
    <Sheet open={open} onClose={onClose} title={t.pickRecipe}>
      <div className="search">
        <Icon name="search" size={18} />
        <input type="search" value={q} placeholder={t.search} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!q && (
        <div className="chips scroll-x">
          {([['sugg', t.suggestions], ['fav', t.favouritesShort], ['top', t.topRated], ['quick', t.quick]] as const).map(([k, l]) => (
            <button key={k} className={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>
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
              <Photo src={r.photo} emoji={r.emoji} className="pick-img" cat={r.category} />
              <span className="pick-text">
                <b>{textFor(r, prefs.lang).title}</b>
                <span className="muted small">{[m ? fmtMinutes(m) : '', avg ? `★ ${avg.toFixed(1)}` : '', prefs.favs.includes(r.id) ? '♥' : ''].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
