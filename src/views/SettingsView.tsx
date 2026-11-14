import { useRef, useState } from 'react';
import { loadProfiles, saveProfiles } from '../lib/health';
import { useStore, setPrefs, flush, importRecipes, relayUrl } from '../lib/store';
import { LANGS } from '../lib/i18n';
import { Icon, Stepper, SyncDot, toast, useT } from '../components/ui';
import type { Recipe } from '../lib/types';

export function SettingsView() {
  const t = useT();
  const prefs = useStore((s) => s.prefs);
  const data = useStore((s) => s.data);
  const sync = useStore((s) => s.sync);
  const lastSync = useStore((s) => s.lastSync);
  const fileRef = useRef<HTMLInputElement>(null);
  const [profiles, setProfiles] = useState(loadProfiles);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cookbook-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const importJson = async (f: File) => {
    try {
      const j = JSON.parse(await f.text());
      const list: Recipe[] = Array.isArray(j) ? j : j.recipes || j.files?.['recipes.json'] ? JSON.parse(j.files['recipes.json']) : [];
      const valid = list.filter((r) => r && typeof r.id === 'number' && (r.fr || r.en));
      importRecipes(valid);
      toast(t.importJsonOk(valid.length));
    } catch {
      toast(t.importFail);
    }
  };

  const syncLabel = { local: t.syncLocal, idle: t.syncOk, saving: t.syncSaving, offline: t.syncOffline, error: t.syncError }[sync];

  return (
    <div className="page settings">
      <header className="page-head">
        <div className="title-row"><h1>{t.settings}</h1></div>
      </header>

      <section className="card-section">
        <h2>{t.language}</h2>
        <div className="seg">
          {LANGS.map((l) => (
            <button key={l.id} className={prefs.lang === l.id ? 'on' : ''} onClick={() => setPrefs({ lang: l.id })}>
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card-section">
        <h2>{t.theme}</h2>
        <div className="seg">
          {([['auto', '🌓', t.themeAuto], ['light', '☀️', t.themeLight], ['dark', '🌙', t.themeDark]] as const).map(([id, e, l]) => (
            <button key={id} className={prefs.theme === id ? 'on' : ''} onClick={() => setPrefs({ theme: id })}>
              {e} {l}
            </button>
          ))}
        </div>
      </section>

      <section className="card-section row-between">
        <h2>{t.household}</h2>
        <Stepper value={prefs.householdServings} onChange={(n) => setPrefs({ householdServings: n })} />
      </section>

      <section className="card-section">
        <h2>{t.healthProfiles}</h2>
        {profiles.length === 0 ? (
          <p className="small muted">{t.noProfiles}</p>
        ) : (
          profiles.map((p) => (
            <div key={p.id} className="row-between">
              <span>{p.emoji} <b>{p.name}</b></span>
              <button className="btn sm" onClick={() => { const next = profiles.filter((x) => x.id !== p.id); saveProfiles(next); setProfiles(next); }}>{t.removeProfile}</button>
            </div>
          ))
        )}
        <p className="small muted">🔒 {t.healthProfilesHint}</p>
      </section>

      <section className="card-section">
        <h2>{t.sync}</h2>
        <p className="row-gap"><SyncDot /> {syncLabel}</p>
        {lastSync && <p className="small muted">{new Date(lastSync).toLocaleString(prefs.lang === 'fr' ? 'fr-FR' : 'en-GB')}</p>}
        {relayUrl() && <button className="btn" onClick={() => flush()}><Icon name="refresh" size={16} /> {t.syncNow}</button>}
      </section>

      <section className="card-section">
        <h2>{t.backup}</h2>
        <div className="row-gap">
          <button className="btn" onClick={exportJson}>{t.exportJson}</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>{t.importJson}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        </div>
      </section>

      <section className="card-section">
        <h2>{t.install}</h2>
        <p className="small muted">{t.installHint}</p>
      </section>

      <p className="small muted center">
        {t.version} 2.0 · {data.recipes.filter((r) => !r.deleted).length} · <a href="https://github.com/bapleg/cookbook" target="_blank" rel="noreferrer">GitHub</a>
      </p>
    </div>
  );
}
