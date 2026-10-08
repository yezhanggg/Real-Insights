// The Subscribe pop-up, built from the 21st.dev "sign-in" design: the form on the left, a city photo with a floating
// card on the right, blur-in entrances. Email only (no accounts, no passwords).
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BadgeCheck, Check, Mail, Map as MapIcon, X } from 'lucide-react';
import { site } from '@/lib/content';
import { navigate } from '@/lib/router';
import { useApp } from '@/lib/store';
import { closeSubscribe, useSubscribe } from '@/lib/subscribe';

const HERO = 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200&q=80&auto=format&fit=crop';

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">{children}</div>
);

const HIGHLIGHTS = [
  { icon: <MapIcon className="h-5 w-5" />, title: 'A live 3D map', text: 'Every dataset on one map. Click any shape for its numbers.' },
  { icon: <BadgeCheck className="h-5 w-5" />, title: 'Every number sourced', text: 'Publisher, date and license with every layer.' },
  { icon: <Mail className="h-5 w-5" />, title: 'One email per release', text: 'Only when new data is on the map. Unsubscribe anytime.' },
];

function Form() {
  const next = useApp((s) => s.subscribeNext);
  const subscribed = useApp((s) => s.subscribed);
  const [email, setEmail] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const go = () => {
    closeSubscribe();
    navigate(next ?? '/map');
    window.scrollTo({ top: 0 });
  };
  const { status, submit } = useSubscribe(next ? `gate:${next}` : 'popup', () => {
    if (next) window.setTimeout(go, 800);
  });
  useEffect(() => {
    const t = window.setTimeout(() => input.current?.focus(), 250);
    return () => window.clearTimeout(t);
  }, []);
  const done = status.kind === 'done' || (subscribed && status.kind === 'idle');

  return (
    <div className="flex flex-col gap-5">
      <p className="animate-element text-xs font-semibold uppercase tracking-[0.25em] text-violet-600">Free · no card · no password</p>
      <h2 id="subscribe-title" className="animate-element animate-delay-100 font-display text-4xl font-semibold leading-tight tracking-tight text-foreground">
        {done ? "You're in." : next ? 'Subscribe to open the map' : 'Subscribe'}
      </h2>
      <p className="animate-element animate-delay-200 text-muted-foreground">
        {done ? 'Everything on the site is open to you now. You will hear from us only when new data is on the map.' : `${site.title} is free. Leave your email and the live map opens right away. One email per release, nothing else.`}
      </p>
      {done ? (
        <div className="animate-element animate-delay-300 space-y-4">
          <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
            <Check className="h-5 w-5 shrink-0" /> You're on the list.
          </p>
          <button type="button" onClick={go} className="w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Explore the map
          </button>
        </div>
      ) : (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit(email);
          }}
        >
          <div className="animate-element animate-delay-300">
            <label htmlFor="subscribe-email" className="text-sm font-medium text-muted-foreground">
              Email address
            </label>
            <GlassInputWrapper>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={input}
                  id="subscribe-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status.kind === 'busy'}
                  className="w-full rounded-2xl bg-transparent p-4 pl-11 text-sm focus:outline-none"
                />
              </div>
            </GlassInputWrapper>
            {status.kind === 'error' && (
              <p className="mt-2 text-sm text-rose-700" role="alert">
                {status.message}
              </p>
            )}
          </div>
          <button type="submit" disabled={status.kind === 'busy'} className="animate-element animate-delay-400 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground shadow-lg shadow-violet-500/30 transition-colors hover:bg-primary/90 disabled:opacity-60">
            {status.kind === 'busy' ? 'Adding you…' : 'Subscribe, free'}
          </button>
        </form>
      )}
    </div>
  );
}

export function SubscribeDialog() {
  const open = useApp((s) => s.subscribeOpen);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeSubscribe();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm" onClick={closeSubscribe}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscribe-title"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            className="relative grid w-full max-w-4xl overflow-hidden rounded-[28px] bg-background shadow-2xl ring-1 ring-black/5 md:grid-cols-[1fr_1fr]"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={closeSubscribe} className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-slate-600 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:text-slate-900" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <section className="p-8 md:p-10">
              <Form />
            </section>
            <section className="relative hidden min-h-[480px] p-3 md:block">
              <div className="animate-slide-right animate-delay-200 absolute inset-3 rounded-[22px] bg-cover bg-center" style={{ backgroundImage: `url(${HERO})` }} />
              <div className="absolute inset-x-8 bottom-8 flex flex-col gap-3">
                {HIGHLIGHTS.map((h, i) => (
                  <div key={h.title} className={`animate-testimonial ${['animate-delay-600', 'animate-delay-800', 'animate-delay-1000'][i]} flex items-start gap-3 rounded-2xl border border-white/20 bg-white/55 p-3.5 backdrop-blur-xl`}>
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">{h.icon}</div>
                    <div className="text-sm leading-snug">
                      <p className="font-medium text-slate-900">{h.title}</p>
                      <p className="text-slate-700">{h.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SubscribeDialog;
