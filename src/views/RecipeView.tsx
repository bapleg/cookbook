import { useEffect, useMemo, useState } from 'react';
import { useStore, toggleFav, rate, deleteRecipe, setSlot, getState } from '../lib/store';
import { textFor, stepsOf, scaleLine, parseServings, totalMinutes, fmtMinutes, isSectionHeader, cleanLine } from '../lib/ingredients';
import { avgRating, iso, addDays, mondayOf, slotKey, dayLabel, defaultServings } from '../lib/plan';
import { go } from '../lib/router';
import { Icon, Photo, Sheet, Stars, Stepper, toast, useT } from '../components/ui';
import { LANGS, MEMBERS } from '../lib/i18n';
import type { Lang, Member, MealSlot } from '../lib/types';

export function RecipeView({ id }: { id: number }) {
  const t = useT();
  const data = useStore((s) => s.data);
  const prefs = useStore((s) => s.prefs);
  const r = data.recipes.find((x) => x.id === id && !x.deleted);
  const [lang, setLang] = useState<Lang>(prefs.lang);
  const base = parseServings(r?.servings) || 0;
  const [servings, setServings] = useState(base || 4);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<number | null>(null);
  const [awake, setAwake] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // keep the screen on while cooking
  useEffect(() => {
    if (!awake || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const req = () =>
      (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => setAwake(false));
    req();
    const onVis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, [awake]);

  const upcoming = useMemo(() => {
    const today = iso(new Date());
    return Object.entries(data.plan.slots)
      .filter(([k, e]) => !e.deleted && e.id === id && k >= today)
      .map(([k]) => k)
      .sort();
  }, [data.plan, id]);

  if (!r) {
    return (
      <div className="page">
        <div className="empty">
          <div className="empty-emoji">🤷</div>
          <h3>{t.noResults}</h3>
          <button className="btn" onClick={() => go('')}>{t.back}</button>
        </div>
      </div>
    );
  }

  const tx = textFor(r, lang);
  const ratio = base ? servings / base : 1;
  const steps = stepsOf(tx);
  const ratings = data.ratings[String(r.id)] || {};
  const avg = avgRating(ratings);
  const fav = prefs.favs.includes(r.id);
  const mins = totalMinutes(r);
  const available = LANGS.filter((l) => r[l.id]?.title);

  const share = async () => {
    const url = location.href;
    const text = `${tx.title}\n\n${tx.ingredients.join('\n')}`;
    try {
      if (navigator.share) await navigator.share({ title: tx.title, text, url });
      else {
        await navigator.clipboard.writeText(`${tx.title}\n${url}`);
        toast(t.copied);
      }
    } catch {
      /* cancelled */
    }
  };

  const del = () => {
    if (confirm(t.deleteConfirm)) {
      deleteRecipe(r.id);
      go('', true);
    }
  };

  return (
    <div className="page recipe-page">
      <div className="hero">
        <Photo src={r.photo} emoji={r.emoji} className="hero-img" />
        <div className="hero-bar">
          <button className="icon-btn glass" onClick={() => (history.length > 1 ? history.back() : go(''))} aria-label={t.back}>
            <Icon name="back" />
          </button>
          <div className="hero-actions">
            <button className={'icon-btn glass' + (fav ? ' fav-on' : '')} onClick={() => toggleFav(r.id)} aria-label={t.favourites}>
              <Icon name="heart" fill={fav} />
            </button>
            <button className="icon-btn glass" onClick={share} aria-label={t.share}>
              <Icon name="share" />
            </button>
          </div>
        </div>
      </div>

      <div className="recipe-wrap">
        <div className="recipe-head">
          <div className="eyebrow">
            {r.emoji} {t[`cat_${r.category}` as const]}
            {r.author ? ` · ${t.by} ${r.author}` : ''}
          </div>
          <h1>{tx.title}</h1>
          <div className="facts">
            {mins ? (
              <span><Icon name="clock" size={16} /> {fmtMinutes(mins)}</span>
            ) : null}
            {r.prepTime && <span className="muted">{t.prep} {r.prepTime}</span>}
            {r.cookTime && <span className="muted">{t.cook} {r.cookTime}</span>}
            {tx.difficulty && <span className="muted">{tx.difficulty}</span>}
            {avg > 0 && <span className="rating">★ {avg.toFixed(1)}</span>}
          </div>
          {(r.tags || []).length > 0 && (
            <div className="tags">
              {r.tags.map((tg) => (
                <span key={tg} className="tag">{tg}</span>
              ))}
            </div>
          )}
          {available.length > 1 && (
            <div className="seg" role="tablist">
              {available.map((l) => (
                <button key={l.id} className={lang === l.id ? 'on' : ''} onClick={() => setLang(l.id)} role="tab" aria-selected={lang === l.id}>
                  {l.flag} {l.label}
                </button>
              ))}
            </div>
          )}

          <div className="action-row">
            <button className="btn primary" onClick={() => setPlanOpen(true)}>
              <Icon name="calendar" size={18} /> {upcoming.length ? `${t.inMenu} · ${upcoming.length}` : t.addToMenu}
            </button>
            <button className={'btn' + (awake ? ' on' : '')} onClick={() => setAwake(!awake)} title={t.keepAwake}>
              <Icon name="sun" size={18} /> {t.keepAwake}
            </button>
          </div>
        </div>

        <div className="recipe-cols">
          <section className="ingredients">
            <div className="section-head">
              <h2>{t.ingredients}</h2>
              {base > 0 && (
                <span className="servings">
                  <Icon name="users" size={16} />
                  <Stepper value={servings} onChange={setServings} />
                </span>
              )}
            </div>
            {tx.ingredients.length === 0 ? (
              <p className="muted">{t.toComplete}</p>
            ) : (
              <ul className="ing-list">
                {tx.ingredients.map((line, i) =>
                  isSectionHeader(line) ? (
                    <li key={i} className="ing-section">{cleanLine(line)}</li>
                  ) : (
                    <li key={i} className={checked.has(i) ? 'done' : ''} onClick={() => {
                      const n = new Set(checked);
                      n.has(i) ? n.delete(i) : n.add(i);
                      setChecked(n);
                    }}>
                      <span className="tick">{checked.has(i) && <Icon name="check" size={14} />}</span>
                      <span>{cleanLine(scaleLine(line, ratio))}</span>
                    </li>
                  )
                )}
              </ul>
            )}
          </section>

          <section className="steps">
            <h2>{t.steps}</h2>
            <ol className="step-list">
              {steps.map((s, i) => (
                <li key={i} className={step === i ? 'current' : step !== null && i < step ? 'past' : ''} onClick={() => setStep(step === i ? null : i)}>
                  <span className="step-num">{i + 1}</span>
                  <p>{s}</p>
                </li>
              ))}
            </ol>
            {tx.notes && (
              <div className="notes">
                <h3>{t.notes}</h3>
                <p>{tx.notes}</p>
              </div>
            )}
            {r.sourceUrl && (
              <p className="small muted">
                {t.source}: <a href={r.sourceUrl} target="_blank" rel="noreferrer">{new URL(r.sourceUrl).hostname.replace('www.', '')}</a>
              </p>
            )}
          </section>
        </div>

        <section className="family">
          <h2>{t.family}</h2>
          <div className="members">
            {MEMBERS.map((m) => (
              <div key={m.id} className="member">
                <span>{m.label}</span>
                <Stars value={(ratings as Record<string, number>)[m.id] || 0} onChange={(n) => rate(r.id, m.id as Member, n)} size={22} />
              </div>
            ))}
          </div>
        </section>

        <div className="footer-actions">
          <button className="btn" onClick={() => go(`r/${r.id}/edit`)}><Icon name="edit" size={18} /> {t.edit}</button>
          <button className="btn" onClick={() => window.print()}><Icon name="print" size={18} /> {t.print}</button>
          <button className="btn danger" onClick={del}><Icon name="trash" size={18} /> {t.delete}</button>
        </div>
      </div>

      <AddToPlanSheet open={planOpen} onClose={() => setPlanOpen(false)} recipeId={r.id} servings={servings} />
    </div>
  );
}

function AddToPlanSheet({ open, onClose, recipeId, servings }: { open: boolean; onClose: () => void; recipeId: number; servings: number }) {
  const t = useT();
  const data = useStore((s) => s.data);
  const prefs = useStore((s) => s.prefs);
  const [weekOffset, setWeekOffset] = useState(0);
  const start = addDays(mondayOf(new Date()), weekOffset * 7);
  const today = iso(new Date());
  const slots: MealSlot[] = prefs.showLunch ? ['lunch', 'dinner'] : ['dinner'];
  const r = data.recipes.find((x) => x.id === recipeId)!;
  const serv = servings || defaultServings(r, prefs.householdServings);

  return (
    <Sheet open={open} onClose={onClose} title={t.addToMenu}>
      <div className="week-nav">
        <button className="icon-btn" onClick={() => setWeekOffset(weekOffset - 1)} disabled={weekOffset <= 0} aria-label="‹"><Icon name="chevronL" /></button>
        <span>{weekOffset === 0 ? t.thisWeek : `${t.weekOf} ${dayLabel(start, prefs.lang).num} ${dayLabel(start, prefs.lang).month}`}</span>
        <button className="icon-btn" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="›"><Icon name="chevronR" /></button>
      </div>
      <div className="pick-days">
        {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
          const day = iso(d);
          const past = day < today;
          const lbl = dayLabel(d, prefs.lang);
          return (
            <div key={day} className={'pick-day' + (past ? ' past' : '')}>
              <div className="pick-date">
                <b>{lbl.short}</b> {lbl.num}
              </div>
              {slots.map((s) => {
                const e = data.plan.slots[slotKey(day, s)];
                const occupied = e && !e.deleted ? getState().data.recipes.find((x) => x.id === e.id) : undefined;
                const mine = occupied?.id === recipeId;
                return (
                  <button
                    key={s}
                    disabled={past}
                    className={'pick-slot' + (mine ? ' on' : '') + (occupied && !mine ? ' taken' : '')}
                    onClick={() => {
                      if (mine) setSlot(slotKey(day, s), null);
                      else {
                        setSlot(slotKey(day, s), { id: recipeId, servings: serv });
                        toast(`${t.inMenu} · ${lbl.short} ${lbl.num}`);
                      }
                    }}
                  >
                    <span className="small muted">{s === 'lunch' ? t.lunch : t.dinner}</span>
                    <span className="pick-title">{mine ? '✓' : occupied ? `${occupied.emoji} ${textFor(occupied, prefs.lang).title}` : '+'}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
