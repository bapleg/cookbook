import { useState } from 'react';
import { useStore, setSlot, getState } from '../lib/store';
import { textFor } from '../lib/ingredients';
import { iso, addDays, mondayOf, slotKey, dayLabel, defaultServings, mealsOn, nextFreeDay, fromIso } from '../lib/plan';
import { Icon, Sheet, toast, useT } from './ui';
import type { MealSlot, Recipe } from '../lib/types';

/** Menu state shared by the home page and recipe pages: quick add + day picker. */
let openPicker: ((r: Recipe) => void) | null = null;

export function useQuickAdd() {
  const t = useT();
  return (r: Recipe, servings?: number) => {
    const s = getState();
    const day = nextFreeDay(s.data);
    const key = slotKey(day, 'dinner', r.id);
    setSlot(key, { id: r.id, servings: servings || defaultServings(r, s.prefs.householdServings) });
    const l = dayLabel(fromIso(day), s.prefs.lang);
    toast(t.addedTo(`${day === iso(new Date()) ? t.today : l.short} ${l.num}`), {
      label: t.changeDay,
      onClick: () => {
        setSlot(key, null);
        openPicker?.(r);
      }
    });
  };
}

export function openDayPicker(r: Recipe) {
  openPicker?.(r);
}

/** Upcoming menu entries for a recipe (today onwards). */
export function upcomingKeys(recipeId: number): string[] {
  const today = iso(new Date());
  return Object.entries(getState().data.plan.slots)
    .filter(([k, e]) => !e.deleted && e.id === recipeId && k.split('|')[0] >= today)
    .map(([k]) => k)
    .sort();
}

/** Mounted once in the app shell. */
export function DayPickerHost() {
  const t = useT();
  const data = useStore((s) => s.data);
  const prefs = useStore((s) => s.prefs);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  openPicker = (r) => {
    setWeekOffset(0);
    setRecipe(r);
  };
  if (!recipe) return null;

  const start = addDays(mondayOf(new Date()), weekOffset * 7);
  const today = iso(new Date());
  const slots: MealSlot[] = prefs.showLunch ? ['lunch', 'dinner'] : ['dinner'];
  const serv = defaultServings(recipe, prefs.householdServings);
  const lbl0 = dayLabel(start, prefs.lang);

  return (
    <Sheet open onClose={() => setRecipe(null)} title={`${recipe.emoji} ${textFor(recipe, prefs.lang).title}`}>
      <p className="muted small">{t.chooseDay}</p>
      <div className="week-nav">
        <button className="icon-btn" onClick={() => setWeekOffset(weekOffset - 1)} disabled={weekOffset <= 0} aria-label="‹"><Icon name="chevronL" /></button>
        <span className="week-label">{weekOffset === 0 ? t.thisWeek : `${t.weekOf} ${lbl0.num} ${lbl0.month}`}</span>
        <button className="icon-btn" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="›"><Icon name="chevronR" /></button>
      </div>
      <div className="pick-days">
        {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
          const day = iso(d);
          const past = day < today;
          const lbl = dayLabel(d, prefs.lang);
          return (
            <div key={day} className={'pick-day' + (past ? ' past' : '')}>
              <div className="pick-date"><b>{lbl.short}</b> {lbl.num}</div>
              {slots.map((s) => {
                const meals = mealsOn(data, day, s);
                const mine = meals.find((m) => m.id === recipe.id);
                const others = meals.filter((m) => m.id !== recipe.id);
                return (
                  <button
                    key={s}
                    disabled={past}
                    className={'pick-slot' + (mine ? ' on' : '') + (others.length ? ' taken' : '')}
                    onClick={() => {
                      if (mine) setSlot(mine.key, null);
                      else {
                        setSlot(slotKey(day, s, recipe.id), { id: recipe.id, servings: serv });
                        toast(t.addedTo(`${lbl.short} ${lbl.num}`));
                        setRecipe(null);
                      }
                    }}
                  >
                    {prefs.showLunch && <span className="small muted">{s === 'lunch' ? t.lunch : t.dinner}</span>}
                    <span className="pick-title">
                      {mine ? `✓ ${recipe.emoji}` : '+'}
                      {others.map((m) => {
                        const o = data.recipes.find((x) => x.id === m.id);
                        return o ? ` ${o.emoji}` : '';
                      })}
                    </span>
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
