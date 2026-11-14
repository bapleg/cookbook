import { useMemo, useState, useDeferredValue } from 'react';
import { useStore, setPrefs, visibleRecipes, setSlot } from '../lib/store';
import { textFor, dietOf, matchesDiet, totalMinutes, fmtMinutes } from '../lib/ingredients';
import { avgRating, isComplete, iso, mealsOn, mondayOf, addDays } from '../lib/plan';
import { useQuickAdd, openDayPicker } from '../components/menu';
import { NutriBadge } from '../components/nutrition';
import { go } from '../lib/router';
import { Icon, Photo, Sheet, TagPills, toast, useT } from '../components/ui';
import type { Category, DietFilter, Recipe } from '../lib/types';

type Sort = 'rating' | 'az' | 'time' | 'new';
const CATS: ('all' | Category)[] = ['all', 'plats', 'entrees', 'salades', 'desserts'];
const DIETS: DietFilter[] = ['veg', 'gf', 'df', 'ef', 'quick'];
const CAT_EMOJI: Record<string, string> = { all: '✨', plats: '🍲', entrees: '🥟', salades: '🥗', desserts: '🍰' };

function fold(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function RecipesView() {
  const t = useT();
  const data = useStore((s) => s.data);
  const prefs = useStore((s) => s.prefs);
  const [q, setQ] = useState(() => sessionStorage.getItem('cb_q') || '');
  const [cat, setCat] = useState<'all' | Category>(() => (sessionStorage.getItem('cb_cat') as Category) || 'all');
  const [sort, setSort] = useState<Sort>(() => (sessionStorage.getItem('cb_sort') as Sort) || 'rating');
  const [favOnly, setFavOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const dq = useDeferredValue(q);
  const lang = prefs.lang;

  const recipes = useMemo(() => visibleRecipes(data), [data]);
  const diets = useMemo(() => new Map(recipes.map((r) => [r.id, dietOf(r)])), [recipes]);
  const planned = useMemo(() => {
    const today = iso(new Date());
    const m = new Map<number, string>();
    for (const [k, e] of Object.entries(data.plan.slots)) if (!e.deleted && k.split('|')[0] >= today && !m.has(e.id)) m.set(e.id, k);
    return m;
  }, [data.plan]);

  const list = useMemo(() => {
    const terms = fold(dq).split(/\s+/).filter(Boolean);
    const out = recipes.filter((r) => {
      if (cat !== 'all' && r.category !== cat) return false;
      if (favOnly && !prefs.favs.includes(r.id)) return false;
      if (!matchesDiet(r, diets.get(r.id)!, prefs.dietFilters)) return false;
      if (terms.length) {
        const hay = fold([r.fr, r.en, r.vi].map((x) => (x ? x.title + ' ' + x.ingredients.join(' ') : '')).join(' ') + ' ' + (r.tags || []).join(' ') + ' ' + (r.author || ''));
        if (!terms.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const title = (r: Recipe) => textFor(r, lang).title;
    const by: Record<Sort, (a: Recipe, b: Recipe) => number> = {
      rating: (a, b) =>
        Number(isComplete(b)) - Number(isComplete(a)) ||
        avgRating(data.ratings[String(b.id)]) - avgRating(data.ratings[String(a.id)]) ||
        Number(prefs.favs.includes(b.id)) - Number(prefs.favs.includes(a.id)) ||
        b.id - a.id,
      az: (a, b) => title(a).localeCompare(title(b), lang),
      time: (a, b) => (totalMinutes(a) || 999) - (totalMinutes(b) || 999),
      new: (a, b) => b.id - a.id
    };
    return out.sort(by[sort]);
  }, [recipes, dq, cat, favOnly, prefs.favs, prefs.dietFilters, sort, lang, data.ratings, diets]);

  const persist = (k: string, v: string) => sessionStorage.setItem(k, v);
  const activeFilters = prefs.dietFilters.length + (favOnly ? 1 : 0);

  const toggleDiet = (d: DietFilter) =>
    setPrefs({ dietFilters: prefs.dietFilters.includes(d) ? prefs.dietFilters.filter((x) => x !== d) : [...prefs.dietFilters, d] });

  return (
    <div className="page">
      <header className="page-head">
        <Welcome />
        <div className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={q}
            placeholder={t.search}
            onChange={(e) => {
              setQ(e.target.value);
              persist('cb_q', e.target.value);
            }}
            aria-label={t.search}
          />
          {q && (
            <button className="icon-btn sm" onClick={() => { setQ(''); persist('cb_q', ''); }} aria-label="Clear">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        <div className="chips scroll-x">
          {CATS.map((c) => (
            <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => { setCat(c); persist('cb_cat', c); }}>
              {CAT_EMOJI[c]} {c === 'all' ? t.all : t[`cat_${c}` as const]}
            </button>
          ))}
          <span className="chip-sep" />
          <button className={'chip' + (favOnly ? ' on' : '')} onClick={() => setFavOnly(!favOnly)}>
            <Icon name="heart" size={14} fill={favOnly} /> {t.favourites}
          </button>
          <button className={'chip' + (prefs.dietFilters.length ? ' on' : '')} onClick={() => setFiltersOpen(true)}>
            <Icon name="filter" size={14} /> {t.filters}
            {prefs.dietFilters.length ? ` · ${prefs.dietFilters.length}` : ''}
          </button>
        </div>
      </header>

      <div className="list-meta">
        <span className="muted small">{t.recipesCount(list.length)}</span>
        <select className="sort" value={sort} onChange={(e) => { setSort(e.target.value as Sort); persist('cb_sort', e.target.value); }} aria-label={t.sort}>
          <option value="rating">{t.sort_rating}</option>
          <option value="new">{t.sort_new}</option>
          <option value="time">{t.sort_time}</option>
          <option value="az">{t.sort_az}</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <div className="empty-emoji">🍳</div>
          <h3>{t.noResults}</h3>
          <p className="muted">{t.noResultsHint}</p>
          {(activeFilters > 0 || q || cat !== 'all') && (
            <button className="btn" onClick={() => { setQ(''); setCat('all'); setFavOnly(false); setPrefs({ dietFilters: [] }); }}>
              {t.clearFilters}
            </button>
          )}
        </div>
      ) : (
        <div className="grid">
          {list.map((r) => (
            <RecipeCard key={r.id} r={r} lang={lang} fav={prefs.favs.includes(r.id)} rating={avgRating(data.ratings[String(r.id)])} plannedKey={planned.get(r.id)} />
          ))}
        </div>
      )}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t.filters}>
        <div className="chips wrap">
          {DIETS.map((d) => (
            <button key={d} className={'chip lg' + (prefs.dietFilters.includes(d) ? ' on' : '')} onClick={() => toggleDiet(d)}>
              {prefs.dietFilters.includes(d) && <Icon name="check" size={14} />} {t[`diet_${d}` as const]}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function Welcome() {
  const t = useT();
  const data = useStore((s) => s.data);
  const lang = useStore((s) => s.prefs.lang);
  const h = new Date().getHours();
  const hi = h < 12 ? t.hiMorning : h < 18 ? t.hiAfternoon : t.hiEvening;
  const today = iso(new Date());
  const tonight = mealsOn(data, today, 'dinner')
    .map((m) => data.recipes.find((r) => r.id === m.id))
    .filter(Boolean) as Recipe[];
  const start = mondayOf(new Date());
  let weekCount = 0;
  for (let i = 0; i < 7; i++) weekCount += mealsOn(data, iso(addDays(start, i)), 'dinner').length + mealsOn(data, iso(addDays(start, i)), 'lunch').length;
  const total = data.recipes.filter((r) => !r.deleted).length;
  return (
    <section className="welcome">
      <div className="welcome-deco" aria-hidden="true">
        <span>🥕</span><span>🍋</span><span>🧁</span><span>🍅</span><span>🥖</span><span>🍓</span>
      </div>
      <p className="welcome-hi">{hi} 👋</p>
      <p className="welcome-kicker">{t.welcomeKicker}</p>
      <h1 className="welcome-title">{t.welcomeTitle}</h1>
      <p className="welcome-script">{t.welcomeScript}</p>
      <p className="welcome-q">{t.welcomeQ}</p>
      <div className="welcome-tonight">
        {tonight.length ? (
          tonight.map((r) => (
            <button key={r.id} className="tonight-card" onClick={() => go(`r/${r.id}`)}>
              <Photo src={r.photo} emoji={r.emoji} className="tonight-img" cat={r.category} />
              <span>
                <span className="small">{t.tonight}</span>
                <b>{textFor(r, lang).title}</b>
              </span>
            </button>
          ))
        ) : (
          <button className="tonight-card empty" onClick={() => go('plan')}>
            <span className="tonight-img photo-fallback"><span>🍽️</span></span>
            <span>
              <span className="small">{t.tonight}</span>
              <b>{t.nothingTonight}</b>
            </span>
            <Icon name="chevronR" size={18} />
          </button>
        )}
      </div>
      <p className="welcome-stats">📖 {t.recipesCount(total)} · 📅 {t.plannedThisWeek(weekCount)}</p>
    </section>
  );
}

function RecipeCard({ r, lang, fav, rating, plannedKey }: { r: Recipe; lang: 'fr' | 'en' | 'vi'; fav: boolean; rating: number; plannedKey?: string }) {
  const t = useT();
  const quickAdd = useQuickAdd();
  const tx = textFor(r, lang);
  const mins = totalMinutes(r);
  const complete = isComplete(r);
  return (
    <article className={'card cat-' + r.category} onClick={() => go(`r/${r.id}`)} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go(`r/${r.id}`)}>
      <div className="card-img">
        <Photo src={r.photo} emoji={r.emoji} cat={r.category} />
        {complete && (
          <button
            className={'menu-btn' + (plannedKey ? ' on' : '')}
            aria-label={plannedKey ? t.inMenu : t.addToMenu}
            title={plannedKey ? t.inMenu : t.addToMenu}
            onClick={(e) => {
              e.stopPropagation();
              if (plannedKey) {
                setSlot(plannedKey, null);
                toast(t.removedFromMenu, { label: t.chooseDay, onClick: () => openDayPicker(r) });
              } else quickAdd(r);
            }}
          >
            <Icon name={plannedKey ? 'check' : 'calendar'} size={17} />
            <span>{plannedKey ? t.inMenu : t.addToMenu}</span>
          </button>
        )}
        {fav && <span className="fav-flag" aria-label={t.favourites}>♥</span>}
        {!complete && <span className="badge todo">{t.toComplete}</span>}
      </div>
      <div className="card-body">
        <h3><span className="card-emoji" aria-hidden="true">{r.emoji}</span> {tx.title}</h3>
        <div className="card-meta">
          {mins ? (
            <span>
              <Icon name="clock" size={13} /> {fmtMinutes(mins)}
            </span>
          ) : null}
          {rating > 0 && <span className="rating">★ {rating.toFixed(1)}</span>}
          <NutriBadge r={r} plain />
        </div>
        <TagPills tags={r.tags} limit={2} />
      </div>
    </article>
  );
}
