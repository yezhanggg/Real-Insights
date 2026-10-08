// The Subscribe pop-up: one card (the 21st.dev "health-stat-card") with the email form under its legend. Email only
// (no accounts, no passwords). Before launch (`launched: false` in content/site.yaml) it is a wait-list: put down an
// email and wait for the launch. Its three facts are words, and its bars carry no figures; they name what is coming,
// and the one pointed at is described in a caption inside the chart panel.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Mail, MapPinned, Rocket, X } from 'lucide-react';
import { site } from '@/lib/content';
import { navigate } from '@/lib/router';
import { useApp } from '@/lib/store';
import { closeSubscribe, useSubscribe } from '@/lib/subscribe';
import { HealthStatCard, type HealthGraphData, type StatData } from './health-stat-card';

/** What the site is made of. The heights are for the eye only (a skyline), so no percentages are shown. */
const PARTS: HealthGraphData[] = [
  { label: 'Live map', value: 92, color: '#7c3aed', description: 'Every dataset on one 3D map. Click a shape for its numbers.' },
  { label: 'Insights', value: 64, color: '#a78bfa', description: 'Each new dataset as it lands, newest first.' },
  { label: 'Ask the map', value: 78, color: '#22d3ee', description: 'Answers from the published data, checked number by number.' },
  { label: 'Open data', value: 52, color: '#4c1d95', description: 'Source, date, license and a download with every layer.' },
];

function Form({ waiting }: { waiting: boolean }) {
  const next = useApp((s) => s.subscribeNext);
  const subscribed = useApp((s) => s.subscribed);
  const [email, setEmail] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const go = () => {
    closeSubscribe();
    navigate(next ?? '/map');
    window.scrollTo({ top: 0 });
  };
  const { status, submit } = useSubscribe(next ? `gate:${next}` : waiting ? 'launch' : 'popup', () => {
    if (next && !waiting) window.setTimeout(go, 800);
  });
  useEffect(() => {
    const t = window.setTimeout(() => input.current?.focus(), 250);
    return () => window.clearTimeout(t);
  }, []);
  const done = status.kind === 'done' || (subscribed && status.kind === 'idle');

  if (done)
    return (
      <div className="mt-6 space-y-3">
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          <Check className="h-5 w-5 shrink-0" /> {waiting ? "You're on the list. One email, the day the map opens." : "You're on the list."}
        </p>
        {waiting ? (
          <button type="button" onClick={closeSubscribe} className="w-full rounded-xl bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Done
          </button>
        ) : (
          <button type="button" onClick={go} className="w-full rounded-xl bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Explore the map
          </button>
        )}
      </div>
    );
  return (
    <form
      className="mt-6 space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit(email);
      }}
    >
      <p className="text-sm text-muted-foreground">
        {waiting
          ? `${site.title} is almost ready. Put down your email and wait for the launch: one email the day the map opens, nothing else.`
          : `${site.title} is free. Leave your email and the live map opens right away. One email per release, nothing else.`}
      </p>
      <div>
        <label htmlFor="subscribe-email" className="sr-only">
          Email address
        </label>
        <div className="relative rounded-xl border border-border bg-foreground/[0.03] transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={input}
            id="subscribe-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status.kind === 'busy'}
            className="w-full rounded-xl bg-transparent p-3.5 pl-11 text-sm focus:outline-none"
          />
        </div>
        {status.kind === 'error' && (
          <p className="mt-2 text-sm text-rose-700" role="alert">
            {status.message}
          </p>
        )}
      </div>
      <button type="submit" disabled={status.kind === 'busy'} className="w-full rounded-xl bg-primary py-3.5 text-sm font-medium text-primary-foreground shadow-lg shadow-violet-500/25 transition-colors hover:bg-primary/90 disabled:opacity-60">
        {status.kind === 'busy' ? 'Adding you…' : waiting ? 'Join the launch list' : 'Subscribe, free'}
      </button>
    </form>
  );
}

export function SubscribeDialog() {
  const open = useApp((s) => s.subscribeOpen);
  const next = useApp((s) => s.subscribeNext);
  const waiting = !site.launched;
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

  const stats: StatData[] = [
    { value: 'Free', title: 'No card needed' },
    { value: 1, unit: 'email', title: waiting ? 'On launch day' : 'Per release' },
    { value: 'Open', title: 'Data to download' },
  ];

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
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={closeSubscribe} className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <HealthStatCard
              className="rounded-3xl border-black/5 p-7 shadow-2xl"
              headerIcon={
                waiting ? (
                  <span className="rocket-pad">
                    <Rocket className="rocket-launch h-6 w-6" />
                  </span>
                ) : (
                  <MapPinned className="h-6 w-6" />
                )
              }
              title={waiting ? 'Wait for the launch' : next ? 'Subscribe to open the map' : 'Subscribe'}
              titleId="subscribe-title"
              stats={stats}
              graphData={PARTS}
              graphHeight={104}
              barMaxWidth={44}
              showValues={false}
              legendTitle={waiting ? 'Launching with' : 'On the site'}
            >
              <Form waiting={waiting} />
            </HealthStatCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SubscribeDialog;
