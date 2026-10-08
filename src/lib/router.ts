// A small router: the History API and one hook. Paths: /  /updates  /map  /map/:layer  /subscribe (opens the pop-up)
import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
window.addEventListener('popstate', notify);

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (to === location.pathname + location.search) return;
  if (opts.replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  notify();
}

const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
export const usePath = () => useSyncExternalStore(subscribe, () => location.pathname + location.search);

export type Route = { name: 'landing' } | { name: 'updates' } | { name: 'map'; layer?: string } | { name: 'subscribe'; next: string | null } | { name: 'missing' };

export function parse(path: string): Route {
  const p = path.split('?')[0].replace(/\/+$/, '') || '/';
  if (p === '/') return { name: 'landing' };
  if (p === '/updates') return { name: 'updates' };
  if (p === '/subscribe') {
    const next = new URLSearchParams(location.search).get('next');
    // Only paths on this site, never another address.
    return { name: 'subscribe', next: next && /^\/[a-z0-9/-]*$/.test(next) ? next : null };
  }
  // /atlas was the map's old address.
  const m = p.match(/^\/(?:map|atlas)(?:\/([a-z0-9-]+))?$/);
  if (m) return { name: 'map', layer: m[1] };
  return { name: 'missing' };
}

/** onClick for <a href>: plain left-clicks route in-app; modified clicks open a tab as usual. */
export function linkClick(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = e.currentTarget.getAttribute('href');
  if (!href || !href.startsWith('/')) return;
  e.preventDefault();
  navigate(href);
  window.scrollTo({ top: 0 });
}

