// Before launch (`launched: false` in content/site.yaml), /map and /updates show this page instead of the map and
// Insights: a thinking orb, "Superloading…", "Coming soon". The orb is the "breathing" state of Thinking Orbs
// (21st.dev "thinking-orb"), drawn large by LargeOrb in ui/thinking-orbs.tsx.
import { useEffect, useState } from 'react';
import { site } from '../lib/content';
import { linkClick } from '../lib/router';
import { LargeOrb } from './ui/thinking-orbs';

const WHAT = {
  map: { name: 'Explore map', line: 'The live map is on its way.' },
  insights: { name: 'Insights', line: 'The insights are on their way.' },
};

/** The orb takes about two fifths of the screen's shorter side: 240 px on a desktop or tablet, less on a phone. */
function useOrbSize() {
  const measure = () => Math.round(Math.max(120, Math.min(240, Math.min(window.innerWidth, window.innerHeight) * 0.42)));
  const [size, setSize] = useState(measure);
  useEffect(() => {
    const onResize = () => setSize(measure());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

export default function ComingSoon({ what }: { what: keyof typeof WHAT }) {
  const { name, line } = WHAT[what];
  const orb = useOrbSize();
  useEffect(() => {
    document.title = `${name}: coming soon · ${site.title}`;
  }, [name]);
  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_6%_0%,#fffdfb_0%,#fcfbff_40%,#f6f2ff_100%)]">
      <main className="grid min-h-[100svh] place-items-center px-[var(--gutter)] pb-8 pt-[var(--header-h)] short:pb-3">
        {/* Stacked and centered; on a phone held sideways there is no height for that, so orb and words sit side by side. */}
        <div className="flex flex-col items-center text-center short:flex-row short:gap-10 short:text-left">
          <LargeOrb state="breathing" size={orb} />
          <div className="mt-8 flex max-w-md flex-col items-center short:mt-0 short:items-start">
            <p className="text-xs font-medium uppercase tracking-[0.36em] text-violet-500 max-[539px]:text-[11px] max-[539px]:tracking-[0.28em]">{name} · Coming soon</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950" role="status">
              Superloading…
            </h1>
            <p className="mt-2 text-balance text-sm text-[#7f7699]">{line} Subscribe for one email the day it opens.</p>
            <a href="/" onClick={linkClick} className="mt-8 py-2 text-[11px] uppercase tracking-[0.25em] text-[#5b4d83] transition-colors hover:text-violet-600 short:mt-4">
              ← Back to the start
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
