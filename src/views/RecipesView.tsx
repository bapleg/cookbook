import { useMemo, useState, useDeferredValue } from 'react';
import { useStore, setPrefs, toggleFav, visibleRecipes } from '../lib/store';
import { textFor, dietOf, matchesDiet, totalMinutes, fmtMinutes } from '../lib/ingredients';
import { avgRating, isComplete } from '../lib/plan';
import { go } from '../lib/router';
import { Icon, Photo, Sheet, useT } from '../components/ui';
import type { Category, DietFilter, Recipe } from '../lib/types';

type Sort = 'rating' | 'az' | 'time' | 'new';
const CATS: ('all' | Category)[] = ['all', 'plats', 'entrees', 'salades', 'desserts'];
const DIETS: DietFilter[] = ['veg', 'gf', 'df', 'ef', 'quick'];

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
    const today = new Date().toISOString().slice(0, 10);
    return new Set(Object.entries(data.plan.slots).filter(([k, e]) => !e.deleted && k >= today).map(([, e]) => e.id));
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
        <div className="title-row">
          <div>
            <h1>{t.appName}</h1>
            <p className="muted small">{t.tagline}</p>
          </div>
        </div>
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
              {c === 'all' ? t.all : t[`cat_${c}` as const]}
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
            <RecipeCard key={r.id} r={r} lang={lang} fav={prefs.favs.includes(r.id)} rating={avgRating(data.ratings[String(r.id)])} planned={planned.has(r.id)} />
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

function RecipeCard({ r, lang, fav, rating, planned }: { r: Recipe; lang: 'fr' | 'en' | 'vi'; fav: boolean; rating: number; planned: boolean }) {
  const t = useT();
  const tx = textFor(r, lang);
  const mins = totalMinutes(r);
  const complete = isComplete(r);
  return (
    <article className="card" onClick={() => go(`r/${r.id}`)} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go(`r/${r.id}`)}>
      <div className="card-img">
        <Photo src={r.photo} emoji={r.emoji} />
        <button
          className={'fav-btn' + (fav ? ' on' : '')}
          aria-label={t.favourites}
          onClick={(e) => {
            e.stopPropagation();
            toggleFav(r.id);
          }}
        >
          <Icon name="heart" size={18} fill={fav} />
        </button>
        {planned && <span className="badge planned">{t.inMenu}</span>}
        {!complete && <span className="badge todo">{t.toComplete}</span>}
      </div>
      <div className="card-body">
        <h3>{tx.title}</h3>
        <div className="card-meta">
          {mins ? (
            <span>
              <Icon name="clock" size={13} /> {fmtMinutes(mins)}
            </span>
          ) : null}
          {rating > 0 && <span className="rating">★ {rating.toFixed(1)}</span>}
          <span className="cat">{t[`cat_${r.category}` as const]}</span>
        </div>
      </div>
    </article>
  );
}
