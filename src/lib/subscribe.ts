// The one sign-up path on the site (the Subscribe pop-up): POST /api/subscribe, then remember it.
import { useState } from 'react';
import { rememberSubscribed, useApp } from './store';

export type SubscribeStatus = { kind: 'idle' | 'busy' | 'done' } | { kind: 'error'; message: string };

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

export async function subscribe(email: string, source: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isEmail(email)) return { ok: false, message: 'That email address does not look complete.' };
  try {
    const r = await fetch('/api/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.trim(), source }) });
    const j = (await r.json()) as { ok: boolean; reason?: string };
    if (j.ok) {
      rememberSubscribed();
      return { ok: true };
    }
    return {
      ok: false,
      message: j.reason === 'not_configured' ? 'Sign-ups are not switched on yet. Please check back soon.' : j.reason === 'invalid_email' ? 'That email address does not look complete.' : 'Something went wrong on our end. Please try again in a minute.',
    };
  } catch {
    return { ok: false, message: 'Could not reach the server. Are you online?' };
  }
}

/** Form state for a subscribe box. */
export function useSubscribe(source: string, onDone?: () => void) {
  const [status, setStatus] = useState<SubscribeStatus>({ kind: 'idle' });
  const submit = async (email: string) => {
    setStatus({ kind: 'busy' });
    const r = await subscribe(email, source);
    if (r.ok) {
      setStatus({ kind: 'done' });
      onDone?.();
    } else setStatus({ kind: 'error', message: r.message });
  };
  return { status, submit };
}

/** Opens the Subscribe pop-up; `next` is where to go once the reader is in (e.g. "/map"). */
export function openSubscribe(next: string | null = null) {
  useApp.setState({ subscribeOpen: true, subscribeNext: next });
}
export function closeSubscribe() {
  useApp.setState({ subscribeOpen: false, subscribeNext: null });
}
