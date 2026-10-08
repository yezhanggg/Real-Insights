// Vercel function: adds an email to the subscriber list. One address, used only to announce new maps and data.
// Providers, first one configured wins:
//   BUTTONDOWN_API_KEY                 Buttondown (sends the emails for you; can mail /feed.xml automatically)
//   SUPABASE_URL + SUPABASE_SECRET_KEY  your own `subscribers` table (supabase/migrations/0001_subscribers.sql)
// With neither, local development accepts the address without storing it; production answers "not_configured".

interface Req {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}
interface Res {
  status: (n: number) => { json: (b: unknown) => void };
}

export const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export function cleanEmail(body: unknown): { email: string; source: string } | null {
  let b = body;
  if (typeof b === 'string') {
    try {
      b = JSON.parse(b);
    } catch {
      return null;
    }
  }
  if (!b || typeof b !== 'object') return null;
  const o = b as Record<string, unknown>;
  const email = typeof o.email === 'string' ? o.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email) || email.length > 254) return null;
  const source = typeof o.source === 'string' ? o.source.replace(/[^a-z0-9:-]/gi, '').slice(0, 80) : 'site';
  return { email, source };
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'post_only' });
  const input = cleanEmail(req.body);
  if (!input) return res.status(400).json({ ok: false, reason: 'invalid_email' });

  try {
    if (process.env.BUTTONDOWN_API_KEY) {
      const r = await fetch('https://api.buttondown.com/v1/subscribers', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Token ${process.env.BUTTONDOWN_API_KEY}` },
        body: JSON.stringify({ email_address: input.email, tags: [input.source.split(':')[0]], metadata: { source: input.source } }),
      });
      // Already on the list counts as success: the reader is subscribed either way.
      if (r.ok || r.status === 409) return res.status(200).json({ ok: true });
      const text = await r.text();
      if (/already/i.test(text)) return res.status(200).json({ ok: true });
      console.error('[subscribe] buttondown', r.status, text.slice(0, 300));
      return res.status(200).json({ ok: false, reason: 'provider_error' });
    }
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
      const r = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/subscribers?on_conflict=email`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: process.env.SUPABASE_SECRET_KEY,
          authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
          prefer: 'resolution=ignore-duplicates,return=minimal',
        },
        body: JSON.stringify({ email: input.email, source: input.source }),
      });
      if (r.ok) return res.status(200).json({ ok: true });
      console.error('[subscribe] supabase', r.status, (await r.text()).slice(0, 300));
      return res.status(200).json({ ok: false, reason: 'provider_error' });
    }
  } catch (e) {
    console.error('[subscribe]', e);
    return res.status(200).json({ ok: false, reason: 'provider_error' });
  }
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    console.info(`[subscribe] dev: would add ${input.email} (${input.source}); no provider configured`);
    return res.status(200).json({ ok: true, stored: false });
  }
  return res.status(200).json({ ok: false, reason: 'not_configured' });
}
