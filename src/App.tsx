import { useEffect } from 'react';
import { useRoute, go, type Route } from './lib/router';
import { useStore } from './lib/store';
import { Icon, SyncDot, Toaster, useT } from './components/ui';
import { DayPickerHost } from './components/menu';
import { RecipesView } from './views/RecipesView';
import { RecipeView } from './views/RecipeView';
import { EditorView } from './views/EditorView';
import { PlanView } from './views/PlanView';
import { ShopView } from './views/ShopView';
import { SettingsView } from './views/SettingsView';

function tabOf(r: Route): string {
  if (r.name === 'plan') return 'plan';
  if (r.name === 'shop') return 'shop';
  if (r.name === 'new' || r.name === 'edit') return 'new';
  if (r.name === 'settings') return 'settings';
  return 'recipes';
}

export default function App() {
  const route = useRoute();
  const t = useT();
  const lang = useStore((s) => s.prefs.lang);
  const theme = useStore((s) => s.prefs.theme);
  const tab = tabOf(route);

  useEffect(() => {
    document.documentElement.lang = lang === 'vi' ? 'ceb' : lang;
  }, [lang]);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#17130f' : '#fff8ef'));
  }, [theme]);
  useEffect(() => {
    if (route.name !== 'recipe') window.scrollTo(0, 0);
  }, [route.name]);

  const nav = [
    { id: 'recipes', path: '', icon: 'book', label: t.navRecipes },
    { id: 'plan', path: 'plan', icon: 'calendar', label: t.navPlan },
    { id: 'shop', path: 'shop', icon: 'cart', label: t.navShop },
    { id: 'new', path: 'new', icon: 'plus', label: t.navAdd }
  ];

  return (
    <div className="app">
      <nav className="topnav" aria-label="Main">
        <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); go(''); }}>
          <span className="brand-mark">🍳</span> Howatson - Le Gal
        </a>
        <div className="topnav-links">
          {nav.map((n) => (
            <a key={n.id} href={`#/${n.path}`} className={tab === n.id ? 'on' : ''} onClick={(e) => { e.preventDefault(); go(n.path); }}>
              <Icon name={n.icon} size={18} /> {n.label}
            </a>
          ))}
        </div>
        <a href="#/settings" className={'icon-btn' + (tab === 'settings' ? ' on' : '')} onClick={(e) => { e.preventDefault(); go('settings'); }} aria-label={t.settings}>
          <Icon name="settings" size={20} />
          <SyncDot />
        </a>
      </nav>

      <main className="main">
        {route.name === 'recipes' && <RecipesView />}
        {route.name === 'recipe' && <RecipeView id={route.id} key={route.id} />}
        {route.name === 'edit' && <EditorView id={route.id} key={`e${route.id}`} />}
        {route.name === 'new' && <EditorView key="new" />}
        {route.name === 'plan' && <PlanView />}
        {route.name === 'shop' && <ShopView />}
        {route.name === 'settings' && <SettingsView />}
      </main>

      <nav className="tabbar" aria-label="Main">
        {nav.map((n) => (
          <a key={n.id} href={`#/${n.path}`} className={tab === n.id ? 'on' : ''} onClick={(e) => { e.preventDefault(); go(n.path); }}>
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </a>
        ))}
        <a href="#/settings" className={tab === 'settings' ? 'on' : ''} onClick={(e) => { e.preventDefault(); go('settings'); }}>
          <span className="tab-icon-wrap"><Icon name="settings" size={22} /><SyncDot /></span>
          <span>{t.settings}</span>
        </a>
      </nav>
      <DayPickerHost />
      <Toaster />
    </div>
  );
}
