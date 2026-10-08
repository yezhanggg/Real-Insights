// Before launch (`launched: false` in content/site.yaml), /map and /updates show this page instead of the map and
// Insights: a thinking orb, "Superloading…", "Coming soon". The orb is the "breathing" state of Thinking Orbs
// (21st.dev "thinking-orb"), drawn large by LargeOrb in ui/thinking-orbs.tsx.
import { useEffect } from 'react';
import { site } from '../lib/content';
import { linkClick } from '../lib/router';
import SiteHeader from './SiteHeader';
import { LargeOrb } from './ui/thinking-orbs';

const WHAT = {
  map: { name: 'Explore map', line: 'The live map is on its way.' },
  insights: { name: 'Insights', line: 'The insights are on their way.' },
};

export default function ComingSoon({ what }: { what: keyof typeof WHAT }) {
  const { name, line } = WHAT[what];
  useEffect(() => {
    document.title = `${name}: coming soon · ${site.title}`;
  }, [name]);
  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_6%_0%,#fffdfb_0%,#fcfbff_40%,#f6f2ff_100%)]">
      <SiteHeader current={what === 'map' ? 'map' : 'updates'} />
      <main className="mx-auto grid min-h-[calc(100svh-6rem)] max-w-2xl place-items-center px-6 pb-20 text-center">
        <div className="flex flex-col items-center">
          <LargeOrb state="breathing" size={240} />
          <p className="mt-8 text-xs font-medium uppercase tracking-[0.36em] text-violet-500">{name} · Coming soon</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950" role="status">
            Superloading…
          </h1>
          <p className="mt-2 text-balance text-sm text-[#7f7699]">{line} Subscribe for one email the day it opens.</p>
          <a href="/" onClick={linkClick} className="mt-8 text-[11px] uppercase tracking-[0.25em] text-[#5b4d83] transition-colors hover:text-violet-600">
            ← Back to the start
          </a>
        </div>
      </main>
    </div>
  );
}
