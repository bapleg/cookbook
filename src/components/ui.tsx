import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../lib/store';
import { STRINGS, type Strings } from '../lib/i18n';

export function useT(): Strings {
  const lang = useStore((s) => s.prefs.lang);
  return STRINGS[lang];
}

const PATHS: Record<string, string> = {
  book: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 21.5A2.5 2.5 0 0 0 6.5 24H20v-5',
  calendar: 'M3 6h18v15H3zM3 10h18M8 3v4M16 3v4',
  cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2M9 20.5a1 1 0 1 0 0 .01M17 20.5a1 1 0 1 0 0 .01',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  heart: 'M12 20s-7-4.4-9-9a4.5 4.5 0 0 1 9-3 4.5 4.5 0 0 1 9 3c-2 4.6-9 9-9 9z',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.2a3 3 0 0 1 0 5.6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  share: 'M12 3v13M7 8l5-5 5 5M5 14v6h14v-6',
  print: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4.4V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z',
  filter: 'M3 5h18M6 12h12M10 19h4',
  check: 'M5 12l5 5L20 7',
  chevronL: 'M15 6l-6 6 6 6',
  chevronR: 'M9 6l6 6-6 6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  camera: 'M4 7h3l2-3h6l2 3h3v13H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  text: 'M5 6h14M5 12h14M5 18h9',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  refresh: 'M20 11a8 8 0 0 0-14.9-3.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14.9 3.5L20 15M20 20v-5h-5',
  more: 'M5 12h.01M12 12h.01M19 12h.01'
};

export function Icon({ name, size = 20, fill = false, className }: { name: keyof typeof PATHS | string; size?: number; fill?: boolean; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] || ''} />
    </svg>
  );
}

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {title && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

interface ToastMsg { text: string; action?: { label: string; onClick: () => void } }
let toastSet: ((m: ToastMsg | null) => void) | null = null;
export function toast(text: string, action?: ToastMsg['action']) {
  toastSet?.({ text, action });
}
export function Toaster() {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  useEffect(() => {
    toastSet = setMsg;
    return () => {
      toastSet = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), msg.action ? 5000 : 2600);
    return () => window.clearTimeout(t);
  }, [msg]);
  return msg ? (
    <div className="toast" role="status">
      <span>{msg.text}</span>
      {msg.action && (
        <button className="toast-action" onClick={() => { msg.action!.onClick(); setMsg(null); }}>
          {msg.action.label}
        </button>
      )}
    </div>
  ) : null;
}

export function Stars({ value, onChange, size = 18 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <span className="stars" role={onChange ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} className={'star' + (n <= value ? ' on' : '')} style={{ fontSize: size }} onClick={() => onChange(value === n ? 0 : n)} aria-label={`${n}`}>
            ★
          </button>
        ) : (
          <span key={n} className={'star' + (n <= Math.round(value) ? ' on' : '')} style={{ fontSize: size }}>
            ★
          </span>
        )
      )}
    </span>
  );
}

export function SyncDot() {
  const sync = useStore((s) => s.sync);
  const t = useT();
  const label = { local: t.syncLocal, idle: t.syncOk, saving: t.syncSaving, offline: t.syncOffline, error: t.syncError }[sync];
  return <span className={`sync-dot sync-${sync}`} title={label} aria-label={label} />;
}

export function Stepper({ value, onChange, min = 1, max = 30 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <span className="stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label="−">−</button>
      <span>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} aria-label="+">+</button>
    </span>
  );
}

export function Photo({ src, emoji, className, cat }: { src?: string; emoji: string; className?: string; cat?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <div className={(className || '') + ' photo-fallback cat-' + (cat || 'plats')} aria-hidden="true">
        <span>{emoji}</span>
      </div>
    );
  return <img className={className} src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

/** Turns free-form tags into a few friendly, translated, colour-coded pills. */
const TAG_MAP: [RegExp, string, string, string][] = [
  [/^(vege|végé|vegetari|vegatarian|veggie|vegan)/i, 'veg', '🌱', 'green'],
  [/^healthy|^santé|^fresh/i, 'healthy', '💚', 'mint'],
  [/^(rapide|quick|easy|simple|facile|no-oven)/i, 'quick', '⚡', 'yellow'],
  [/^(famil|family|homy|hearthy)/i, 'family', '🏡', 'orange'],
  [/^(kids|fun|enfant)/i, 'kids', '🧒', 'pink'],
  [/^(sans gluten|gluten[- ]free)/i, 'gf', '🌾', 'sand'],
  [/^(sans lait|sans lactose|dairy[- ]free)/i, 'df', '🥛', 'blue'],
  [/^(sans œufs|sans oeufs|egg[- ]free)/i, 'ef', '🥚', 'sand'],
  [/^longevity|^longévité/i, 'longevity', '⏳', 'purple'],
  [/^(comfort|gourmand|mijoté|réconfort)/i, 'comfort', '🤗', 'orange']
];

export function TagPills({ tags, limit }: { tags: string[]; limit?: number }) {
  const t = useT();
  const seen = new Set<string>();
  const pills: { key: string; label: string; emoji: string; color: string }[] = [];
  for (const raw of tags || []) {
    const tag = raw.trim();
    if (!tag) continue;
    const hit = TAG_MAP.find(([re]) => re.test(tag));
    if (hit) {
      if (seen.has(hit[1])) continue;
      seen.add(hit[1]);
      pills.push({ key: hit[1], label: t[`tag_${hit[1]}` as keyof typeof t] as string, emoji: hit[2], color: hit[3] });
    } else {
      const k = tag.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      pills.push({ key: k, label: tag.charAt(0).toUpperCase() + tag.slice(1), emoji: '🏷️', color: 'grey' });
    }
  }
  // known tags first
  pills.sort((a, b) => Number(a.color === 'grey') - Number(b.color === 'grey'));
  const shown = limit ? pills.filter((p) => p.color !== 'grey').slice(0, limit) : pills;
  if (!shown.length) return null;
  return (
    <div className={'tag-pills' + (limit ? ' compact' : '')}>
      {shown.map((p) => (
        <span key={p.key} className={'tag-pill tc-' + p.color}>
          <span aria-hidden="true">{p.emoji}</span> {p.label}
        </span>
      ))}
    </div>
  );
}
