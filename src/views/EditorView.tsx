import { useRef, useState } from 'react';
import { useStore, saveRecipe, relayUrl } from '../lib/store';
import { importFromUrl, importFromImage, parseFreeText, polishRecipe, detectLang, guessEmoji, type Draft } from '../lib/importer';
import { normaliseText } from '../lib/normalise';
import { go } from '../lib/router';
import { Icon, Photo, toast, useT } from '../components/ui';
import { LANGS } from '../lib/i18n';
import type { Category, Lang, Recipe, RecipeText } from '../lib/types';

const CATS: Category[] = ['plats', 'entrees', 'salades', 'desserts'];
const EMOJIS = ['🍽️', '🍝', '🍗', '🥗', '🍰', '🥞', '🍮', '🥧', '🍲', '🍛', '🍚', '🐟', '🍤', '🥩', '🍳', '🌮', '🍕', '🥙', '🍜', '🥘', '🥦', '🍋', '🥑', '🍫', '🍪', '🧁'];

interface Form {
  title: string;
  ingredients: string;
  steps: string;
  notes: string;
}

function toForm(t?: RecipeText): Form {
  return { title: t?.title || '', ingredients: (t?.ingredients || []).join('\n'), steps: t?.directions || '', notes: t?.notes || '' };
}
function fromForm(f: Form, difficulty?: string): RecipeText {
  return {
    title: f.title.trim(),
    ingredients: f.ingredients.split('\n').map((s) => s.trim()).filter(Boolean),
    directions: f.steps.split('\n').map((s) => s.trim()).filter(Boolean).join('\n'),
    notes: f.notes.trim(),
    difficulty
  };
}

async function compressImage(file: File, max = 1000): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const ratio = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * ratio);
    c.height = Math.round(img.height * ratio);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function EditorView({ id }: { id?: number }) {
  const t = useT();
  const prefs = useStore((s) => s.prefs);
  const existing = useStore((s) => (id ? s.data.recipes.find((r) => r.id === id) : undefined));
  const [meta, setMeta] = useState<Omit<Recipe, 'fr' | 'en' | 'vi'>>(() => {
    const { fr: _f, en: _e, vi: _v, ...rest } = existing || ({} as Recipe);
    void _f; void _e; void _v;
    return existing ? rest : { id: Date.now(), emoji: '🍽️', category: 'plats', tags: [], author: '', servings: '4', prepTime: '', cookTime: '', totalTime: '' };
  });
  const [texts, setTexts] = useState<Record<Lang, Form>>(() => ({
    fr: toForm(existing?.fr),
    en: toForm(existing?.en),
    vi: toForm(existing?.vi)
  }));
  const [lang, setLang] = useState<Lang>(() => (existing ? (existing.lang || (existing.fr?.title ? 'fr' : 'en')) : prefs.lang === 'vi' ? 'fr' : prefs.lang));
  const [translate, setTranslate] = useState(!existing);
  const [busy, setBusy] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'url' | 'paste' | 'photo' | null>(existing ? null : 'url');
  const [url, setUrl] = useState('');
  const [paste, setPaste] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const ocrRef = useRef<HTMLInputElement>(null);

  const cur = texts[lang];
  const setCur = (p: Partial<Form>) => setTexts({ ...texts, [lang]: { ...cur, ...p } });

  const applyDraft = (d: Draft) => {
    const src = d.fr!;
    const l = detectLang(src);
    const clean = normaliseText(src, l);
    setTexts({ fr: toForm(), en: toForm(), vi: toForm(), [l]: toForm(clean) } as Record<Lang, Form>);
    setLang(l);
    setMeta((m) => ({
      ...m,
      emoji: d.emoji || m.emoji,
      category: d.category || m.category,
      tags: d.tags?.length ? d.tags : m.tags,
      servings: d.servings || m.servings,
      prepTime: d.prepTime || m.prepTime,
      cookTime: d.cookTime || m.cookTime,
      totalTime: d.totalTime || m.totalTime,
      photo: d.photo || m.photo,
      sourceUrl: d.sourceUrl || m.sourceUrl
    }));
    setImportMode(null);
    setTranslate(true);
    toast(t.importOk);
  };

  const runImport = async (fn: () => Promise<Draft>) => {
    setBusy(t.importing);
    try {
      applyDraft(await fn());
    } catch (e) {
      console.warn(e);
      toast(t.importFail);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const main = fromForm(cur);
    if (!main.title) {
      toast(t.required);
      return;
    }
    setBusy(t.syncSaving);
    const out: Partial<Record<Lang, RecipeText>> = {};
    for (const l of ['fr', 'en', 'vi'] as Lang[]) {
      const f = fromForm(texts[l], existing?.[l]?.difficulty);
      if (f.title) out[l] = normaliseText(f, l);
    }
    if (translate && relayUrl()) {
      const ai = await polishRecipe(out[lang]!, true);
      if (ai) {
        out.fr = ai.fr;
        out.en = ai.en;
        if (ai.vi) out.vi = ai.vi;
        // the original stays exactly as written (only cleaned up)
        out[lang] = normaliseText(main, lang);
      }
    }
    const recipe: Recipe = {
      ...meta,
      emoji: meta.emoji || guessEmoji(main.title),
      lang,
      fr: out.fr,
      en: out.en,
      vi: out.vi,
      deleted: false
    } as Recipe;
    saveRecipe(recipe);
    setBusy(null);
    toast(t.saved);
    go(`r/${recipe.id}`, true);
  };

  return (
    <div className="page editor">
      <header className="page-head">
        <div className="title-row">
          <button className="icon-btn" onClick={() => history.back()} aria-label={t.back}><Icon name="back" /></button>
          <h1>{existing ? t.editRecipe : t.newRecipe}</h1>
          <button className="btn primary sm" onClick={save} disabled={!!busy}>{t.save}</button>
        </div>
      </header>

      {!existing && (
        <section className="import-box">
          <div className="seg">
            <button className={importMode === 'url' ? 'on' : ''} onClick={() => setImportMode('url')}><Icon name="link" size={16} /> {t.importUrl}</button>
            <button className={importMode === 'paste' ? 'on' : ''} onClick={() => setImportMode('paste')}><Icon name="text" size={16} /> {t.importPaste}</button>
            <button className={importMode === 'photo' ? 'on' : ''} onClick={() => setImportMode('photo')}><Icon name="camera" size={16} /> {t.importPhoto}</button>
          </div>
          {importMode === 'url' && (
            <div className="row-gap">
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t.importUrlPh} onKeyDown={(e) => e.key === 'Enter' && url && runImport(() => importFromUrl(url))} />
              <button className="btn" disabled={!url || !!busy} onClick={() => runImport(() => importFromUrl(url.trim()))}>{t.importBtn}</button>
            </div>
          )}
          {importMode === 'paste' && (
            <>
              <textarea rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={t.importPastePh} />
              <button className="btn" disabled={!paste.trim()} onClick={() => runImport(async () => parseFreeText(paste))}>{t.importBtn}</button>
            </>
          )}
          {importMode === 'photo' && (
            <>
              <p className="small muted">{t.importPhotoHint}</p>
              <input ref={ocrRef} type="file" accept="image/*" hidden onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) runImport(() => importFromImage(f, (p) => setBusy(`${t.ocrLoading} ${Math.round(p * 100)}%`)));
              }} />
              <button className="btn" onClick={() => ocrRef.current?.click()}><Icon name="camera" size={18} /> {t.photoUpload}</button>
            </>
          )}
        </section>
      )}

      {busy && <div className="busy">{busy}</div>}

      <section className="form">
        <div className="photo-edit">
          <Photo src={meta.photo} emoji={meta.emoji} className="photo-preview" />
          <div className="photo-actions">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setMeta({ ...meta, photo: await compressImage(f) });
            }} />
            <button className="btn sm" onClick={() => fileRef.current?.click()}><Icon name="camera" size={16} /> {t.photoUpload}</button>
            {meta.photo && <button className="btn sm" onClick={() => setMeta({ ...meta, photo: '' })}>{t.photoRemove}</button>}
            <input type="url" value={meta.photo?.startsWith('data:') ? '' : meta.photo || ''} onChange={(e) => setMeta({ ...meta, photo: e.target.value })} placeholder={t.photoUrl} />
          </div>
        </div>

        <div className="seg">
          {LANGS.map((l) => (
            <button key={l.id} className={lang === l.id ? 'on' : ''} onClick={() => setLang(l.id)}>
              {l.flag} {l.label}{texts[l.id].title ? ' ✓' : ''}
            </button>
          ))}
        </div>

        <label>{t.name}<input value={cur.title} onChange={(e) => setCur({ title: e.target.value })} /></label>

        <div className="grid-2">
          <label>{t.category}
            <select value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value as Category })}>
              {CATS.map((c) => <option key={c} value={c}>{t[`cat_${c}` as const]}</option>)}
            </select>
          </label>
          <label>{t.emoji}
            <select value={meta.emoji} onChange={(e) => setMeta({ ...meta, emoji: e.target.value })}>
              {[...new Set([meta.emoji, ...EMOJIS])].map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label>{t.servings}<input inputMode="numeric" value={meta.servings || ''} onChange={(e) => setMeta({ ...meta, servings: e.target.value })} /></label>
          <label>{t.author}<input value={meta.author || ''} onChange={(e) => setMeta({ ...meta, author: e.target.value })} /></label>
          <label>{t.prep}<input value={meta.prepTime || ''} onChange={(e) => setMeta({ ...meta, prepTime: e.target.value })} placeholder="15 min" /></label>
          <label>{t.cook}<input value={meta.cookTime || ''} onChange={(e) => setMeta({ ...meta, cookTime: e.target.value })} placeholder="30 min" /></label>
        </div>

        <label>{t.ingredientsOnePerLine}<textarea rows={10} value={cur.ingredients} onChange={(e) => setCur({ ingredients: e.target.value })} placeholder={'200 g farine\n3 œufs\n100 g beurre'} /></label>
        <label>{t.stepsOnePerLine}<textarea rows={10} value={cur.steps} onChange={(e) => setCur({ steps: e.target.value })} /></label>
        <label>{t.notes}<textarea rows={3} value={cur.notes} onChange={(e) => setCur({ notes: e.target.value })} /></label>
        <label>{t.tags}<input value={(meta.tags || []).join(', ')} onChange={(e) => setMeta({ ...meta, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></label>

        {relayUrl() && (
          <label className="check-row">
            <input type="checkbox" checked={translate} onChange={(e) => setTranslate(e.target.checked)} />
            <span>{t.autoTranslate}</span>
          </label>
        )}

        <div className="footer-actions">
          <button className="btn" onClick={() => history.back()}>{t.cancel}</button>
          <button className="btn primary" onClick={save} disabled={!!busy}>{t.save}</button>
        </div>
      </section>
    </div>
  );
}
