import { useEffect, useState } from 'react';

export type Route =
  | { name: 'recipes' }
  | { name: 'recipe'; id: number }
  | { name: 'edit'; id: number }
  | { name: 'new' }
  | { name: 'plan' }
  | { name: 'shop' }
  | { name: 'settings' }
  | { name: 'profile'; data: string };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const [a, b, c] = h.split('/');
  if (a === 'r' && b) return c === 'edit' ? { name: 'edit', id: Number(b) } : { name: 'recipe', id: Number(b) };
  if (a === 'new') return { name: 'new' };
  if (a === 'plan') return { name: 'plan' };
  if (a === 'shop') return { name: 'shop' };
  if (a === 'settings') return { name: 'settings' };
  if (a === 'profile' && b) return { name: 'profile', data: h.slice('profile/'.length) };
  return { name: 'recipes' };
}

export function go(path: string, replace = false) {
  const url = '#/' + path.replace(/^\/+/, '');
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function back(fallback = '') {
  if (history.length > 1 && document.referrer !== undefined && sessionStorage.getItem('cb_nav')) history.back();
  else go(fallback, true);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => {
      sessionStorage.setItem('cb_nav', '1');
      setRoute(parseHash(location.hash));
    };
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return route;
}
