import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, useT } from './ui';
import { scaleLine, cleanLine, isSectionHeader } from '../lib/ingredients';
import type { RecipeText } from '../lib/types';

interface Timer { id: number; label: string; total: number; left: number; running: boolean; done: boolean }

/** Durations mentioned in a step: "10 minutes", "1 h 30", "20 à 25 min", "45 sec". */
export function durationsIn(step: string): { label: string; seconds: number }[] {
  const out: { label: string; seconds: number }[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(?:(?:à|-|–|to|or|ou)\s*(\d+(?:[.,]\d+)?)\s*)?(h(?:eures?|ours?|rs?)?|min(?:utes?|s)?|mn|sec(?:ondes?|onds?)?|s\b)(?:\s*(\d{1,2})\b)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(step))) {
    const hi = parseFloat((m[2] || m[1]).replace(',', '.'));
    const unit = m[3].toLowerCase();
    let sec = unit.startsWith('h') ? hi * 3600 : unit.startsWith('s') ? hi : hi * 60;
    if (unit.startsWith('h') && m[4]) sec += Number(m[4]) * 60;
    if (sec >= 20 && sec <= 6 * 3600) out.push({ label: m[0].trim(), seconds: Math.round(sec) });
  }
  return out;
}

function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((d) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.32);
    });
  } catch {
    /* audio unavailable */
  }
  navigator.vibrate?.([300, 150, 300, 150, 300]);
}

export function CookingMode({ text, steps, ratio, title, onClose }: { text: RecipeText; steps: string[]; ratio: number; title: string; onClose: () => void }) {
  const t = useT();
  const [i, setI] = useState(0);
  const [showIng, setShowIng] = useState(false);
  const [timers, setTimers] = useState<Timer[]>([]);
  const idRef = useRef(1);

  // keep the screen on while cooking
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } };
    const req = () => nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    req();
    const onVis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', onVis);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      document.body.classList.remove('no-scroll');
      lock?.release().catch(() => {});
    };
  }, []);

  // tick timers (based on wall clock so they stay right if the phone sleeps)
  const started = useRef(new Map<number, number>());
  useEffect(() => {
    const iv = window.setInterval(() => {
      setTimers((ts) =>
        ts.map((tm) => {
          if (!tm.running || tm.done) return tm;
          const start = started.current.get(tm.id)!;
          const left = Math.max(0, tm.total - Math.round((Date.now() - start) / 1000));
          if (left === 0) {
            beep();
            return { ...tm, left, running: false, done: true };
          }
          return { ...tm, left };
        })
      );
    }, 500);
    return () => window.clearInterval(iv);
  }, []);

  const startTimer = (label: string, seconds: number) => {
    const id = idRef.current++;
    started.current.set(id, Date.now());
    setTimers((ts) => [...ts, { id, label: `${t.stepOf(i + 1, steps.length).split(' ').slice(0, 2).join(' ')} · ${label}`, total: seconds, left: seconds, running: true, done: false }]);
  };

  const step = steps[i] || '';
  const durations = useMemo(() => durationsIn(step), [step]);
  const touch = useRef<number | null>(null);

  return (
    <div className="cook" role="dialog" aria-modal="true" aria-label={t.cookingMode}>
      <header className="cook-head">
        <button className="icon-btn" onClick={onClose} aria-label={t.back}><Icon name="close" /></button>
        <div className="cook-title">
          <span className="small">{t.stepOf(i + 1, steps.length)}</span>
          <b>{title}</b>
        </div>
        <button className={'btn sm' + (showIng ? ' on' : '')} onClick={() => setShowIng(!showIng)}>{t.ingredientsShort}</button>
      </header>
      <div className="cook-progress"><span style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>

      {timers.length > 0 && (
        <div className="cook-timers">
          {timers.map((tm) => (
            <div key={tm.id} className={'cook-timer' + (tm.done ? ' done' : '')}>
              <span className="small">{tm.label}</span>
              <b>{tm.done ? t.timerDone : fmt(tm.left)}</b>
              <button className="icon-btn sm" onClick={() => setTimers((ts) => ts.filter((x) => x.id !== tm.id))} aria-label={t.remove}><Icon name="close" size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {showIng ? (
        <ul className="cook-ing">
          {text.ingredients.map((l, k) =>
            isSectionHeader(l) ? <li key={k} className="ing-section">{cleanLine(l)}</li> : <li key={k}>{cleanLine(scaleLine(l, ratio))}</li>
          )}
        </ul>
      ) : (
        <div
          className="cook-step"
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touch.current == null) return;
            const dx = e.changedTouches[0].clientX - touch.current;
            if (dx < -60 && i < steps.length - 1) setI(i + 1);
            if (dx > 60 && i > 0) setI(i - 1);
            touch.current = null;
          }}
        >
          <span className="cook-num">{i + 1}</span>
          <p>{step}</p>
          {durations.length > 0 && (
            <div className="cook-timer-btns">
              {durations.map((d, k) => (
                <button key={k} className="btn primary" onClick={() => startTimer(d.label, d.seconds)}>
                  <Icon name="clock" size={18} /> {t.startTimer} · {fmt(d.seconds)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <footer className="cook-nav">
        <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="chevronL" size={18} /> {t.prev}</button>
        {i < steps.length - 1 ? (
          <button className="btn primary" onClick={() => setI(i + 1)}>{t.next} <Icon name="chevronR" size={18} /></button>
        ) : (
          <button className="btn primary" onClick={onClose}>{t.finish}</button>
        )}
      </footer>
    </div>
  );
}
