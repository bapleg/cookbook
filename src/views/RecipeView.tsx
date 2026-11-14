import { useEffect, useMemo, useState } from 'react';
import { useStore, toggleFav, rate, deleteRecipe } from '../lib/store';
import { textFor, stepsOf, scaleLine, parseServings, totalMinutes, fmtMinutes, isSectionHeader, cleanLine } from '../lib/ingredients';
import { avgRating, iso, dayLabel, fromIso } from '../lib/plan';
import { go } from '../lib/router';
import { Icon, Photo, Stars, Stepper, TagPills, toast, useT } from '../components/ui';
import { useQuickAdd, openDayPicker } from '../components/menu';
import { NutritionPanel } from '../components/nutrition';
import { CookingMode } from '../components/cooking';
import { LANGS, MEMBERS } from '../lib/i18n';
import type { Lang, Member } from '../lib/types';

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
  const [cooking, setCooking] = useState(false);
  const quickAdd = useQuickAdd();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);


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
        <Photo src={r.photo} emoji={r.emoji} className="hero-img" cat={r.category} />
        <div className="hero-bar">
          <button className="icon-btn glass" onClick={() => (history.length > 1 ? history.back() : go(''))} aria-label={t.back}>
            <Icon name="back" />
          </button>
          <div className="hero-actions">
            <button className="icon-btn glass" onClick={share} aria-label={t.share}>
              <Icon name="share" />
            </button>
          </div>
        </div>
      </div>

      <div className="recipe-wrap">
        <div className="recipe-head">
          <div className="eyebrow-row">
            <span className={'eyebrow cat-text-' + r.category}>
              <span className="eyebrow-emoji">{r.emoji}</span> {t[`cat_${r.category}` as const]}
            </span>
            {r.author && (
              <span className="from-inline" title={t.recipeFrom}>
                <span aria-hidden="true">{authorEmoji(r.author)}</span>
                <span className="from-label">{t.recipeFrom}</span> <b>{r.author}</b>
              </span>
            )}
          </div>
          <h1>{tx.title}</h1>
          <div className="facts">
            {mins ? (
              <span><Icon name="clock" size={16} /> {fmtMinutes(mins)}</span>
            ) : null}
            {r.prepTime && <span className="muted">{t.prep} {r.prepTime}</span>}
            {r.cookTime && <span className="muted">{t.cook} {r.cookTime}</span>}
            {tx.difficulty && <span className="muted">{difficultyLabel(tx.difficulty, lang)}</span>}
            {avg > 0 && <span className="rating">★ {avg.toFixed(1)}</span>}
          </div>
          <TagPills tags={r.tags} />
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
            {upcoming.length ? (
              <button className="btn primary on-menu" onClick={() => openDayPicker(r)}>
                <Icon name="check" size={18} /> {t.inMenu} · {upcoming.map((k) => { const l = dayLabel(fromIso(k.split('|')[0]), prefs.lang); return `${l.short} ${l.num}`; }).join(', ')}
              </button>
            ) : (
              <button className="btn primary" onClick={() => quickAdd(r, base ? servings : undefined)}>
                <Icon name="calendar" size={18} /> {t.addToMenu}
              </button>
            )}
            <button className={'btn' + (fav ? ' fav-on' : '')} onClick={() => toggleFav(r.id)}>
              <Icon name="heart" size={18} fill={fav} /> {t.favourites}
            </button>
            {steps.length > 0 && (
              <button className="btn cook-btn" onClick={() => setCooking(true)}>
                <Icon name="clock" size={18} /> {t.cookingMode}
              </button>
            )}
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

        <NutritionPanel r={r} ratio={ratio} lang={lang} />

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
      {cooking && <CookingMode text={tx} steps={steps} ratio={ratio} title={tx.title} onClose={() => setCooking(false)} />}
    </div>
  );
}

function difficultyLabel(d: string, lang: Lang): string {
  const k = d.toLowerCase().trim();
  const map: Record<string, [string, string]> = {
    'very easy': ['Très facile', 'Very easy'], 'très facile': ['Très facile', 'Very easy'],
    easy: ['Facile', 'Easy'], facile: ['Facile', 'Easy'], sayon: ['Facile', 'Easy'],
    medium: ['Moyen', 'Medium'], moyen: ['Moyen', 'Medium'], moyenne: ['Moyen', 'Medium'],
    hard: ['Difficile', 'Hard'], difficile: ['Difficile', 'Hard']
  };
  const m = map[k];
  if (!m) return d;
  return lang === 'fr' ? m[0] : lang === 'en' ? m[1] : d;
}

function authorEmoji(a: string): string {
  const s = a.toLowerCase();
  if (/mamie|grand-?m|grandma|granny|nonna|lola/.test(s)) return '👵';
  if (/papi|grand-?p|grandpa|lolo|papa alain/.test(s)) return '👴';
  if (/maman|mum|mom|mummy|mama/.test(s)) return '👩‍🍳';
  if (/papa|dad/.test(s)) return '👨‍🍳';
  if (/leah/.test(s) && /bap/.test(s)) return '👫';
  if (/leah|coco|lili|anne/.test(s)) return '👩‍🍳';
  if (/bap|baptiste|fred|romain|loic|arnaud|doug|leopold|ravin|manu/.test(s)) return '🧑‍🍳';
  if (/famille|family/.test(s)) return '👨‍👩‍👧‍👦';
  if (/dr |doctor|ottolenghi|cookbook|jary|michalak|hyman|johnson|saito|staub|mess/.test(s)) return '📖';
  return '🧑‍🍳';
}
