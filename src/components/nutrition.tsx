import { useMemo, useState } from 'react';
import { nutritionOf } from '../lib/nutrition';
import { scoreRecipe, loadProfiles, KIDS_PROFILE, LEVEL_EMOJI, type HealthProfile } from '../lib/health';
import { useT } from './ui';
import type { Recipe, Lang } from '../lib/types';

const NS_COLORS: Record<string, [string, string]> = {
  A: ['#038141', '#fff'],
  B: ['#85bb2f', '#fff'],
  C: ['#fecb02', '#3a2a00'],
  D: ['#ee8100', '#fff'],
  E: ['#e63e11', '#fff']
};

export function NutriBadge({ r, size = 'sm', plain }: { r: Recipe; size?: 'sm' | 'lg'; plain?: boolean }) {
  const n = nutritionOf(r);
  if (!n || n.coverage < 0.6) return null;
  const [bg, fg] = NS_COLORS[n.nutriScore];
  if (plain) return <span className="rating" title="Nutri-Score (estimation)">Nutri-Score {n.nutriScore}</span>;
  if (size === 'lg') {
    return (
      <span className="ns-scale" aria-label={`Nutri-Score ${n.nutriScore}`}>
        {(['A', 'B', 'C', 'D', 'E'] as const).map((l) => (
          <span key={l} className={'ns-cell' + (l === n.nutriScore ? ' on' : '')} style={{ background: NS_COLORS[l][0], color: NS_COLORS[l][1] }}>
            {l}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="ns-badge" style={{ background: bg, color: fg }} title="Nutri-Score (estimation)">
      {n.nutriScore}
    </span>
  );
}

export function NutritionPanel({ r, ratio, lang }: { r: Recipe; ratio: number; lang: Lang }) {
  const t = useT();
  const n = nutritionOf(r);
  if (!n || n.coverage < 0.5) return null;
  const s = n.perServing;
  // portions shown follow the servings stepper: values are per serve, so they don't change with ratio
  void ratio;
  const pE = s.protein * 4;
  const fE = s.fat * 9;
  const cE = s.carbs * 4;
  const tot = pE + fE + cE || 1;
  const bars = [
    { k: 'protein', label: t.protein, g: s.protein, pct: Math.round((pE / tot) * 100), cls: 'm-protein' },
    { k: 'fat', label: t.fat, g: s.fat, pct: Math.round((fE / tot) * 100), cls: 'm-fat' },
    { k: 'carbs', label: t.carbs, g: s.carbs, pct: Math.round((cE / tot) * 100), cls: 'm-carbs' }
  ];
  return (
    <section className="nutrition">
      <div className="section-head">
        <h2>{t.nutrition}</h2>
        <NutriBadge r={r} size="lg" />
      </div>
      <p className="small muted">
        <b className="kcal">{s.kcal} {t.kcal}</b> {t.perServing} · {t.estimate}
      </p>
      <div className="macro-bar" aria-hidden="true">
        {bars.map((b) => (
          <span key={b.k} className={b.cls} style={{ width: `${b.pct}%` }} />
        ))}
      </div>
      <div className="macros">
        {bars.map((b) => (
          <div key={b.k} className="macro">
            <span className="macro-label"><span className={'dot ' + b.cls} />{b.label}</span>
            <b>{b.g} g</b>
            <span className="sub">{b.pct}% kcal</span>
            {b.k === 'carbs' && <span className="sub">{t.starch} {s.starch} g</span>}
            {b.k === 'fat' && <span className="sub">{t.satFat.replace('Graisses ', '').replace('fat', '')} {s.satFat} g</span>}
          </div>
        ))}
      </div>
      <div className="micro">
        <span>{t.fibre} <b>{s.fibre} g</b></span>
        <span>{t.sugars} <b>{s.sugars} g</b></span>
        <span>{t.salt} <b>{s.salt} g</b></span>
        <span>{t.iron} <b>{s.iron} mg</b></span>
      </div>
      <HealthScores r={r} lang={lang} />
    </section>
  );
}

function HealthScores({ r, lang }: { r: Recipe; lang: Lang }) {
  const t = useT();
  const profiles = useMemo<HealthProfile[]>(() => [...loadProfiles(), { ...KIDS_PROFILE, name: t.kidsScore }], [t.kidsScore]);
  const [open, setOpen] = useState<string | null>(null);
  const scores = profiles.map((p) => ({ p, s: scoreRecipe(r, p, lang) })).filter((x) => x.s);
  if (!scores.length) return null;
  return (
    <div className="health">
      <h3>{t.healthScores}</h3>
      <div className="health-list">
        {scores.map(({ p, s }) => (
          <div key={p.id} className={'health-item lv-' + s!.level}>
            <button className="health-row" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
              <span className="health-who">{p.emoji} {p.name}</span>
              <span className="health-val">{LEVEL_EMOJI[s!.level]} <b>{s!.value}</b>/100</span>
            </button>
            {open === p.id && (
              <ul className="health-reasons">
                {s!.reasons.map((x, i) => (
                  <li key={i} className={x.good ? 'good' : 'bad'}>{x.good ? '✓' : '•'} {x.text}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
