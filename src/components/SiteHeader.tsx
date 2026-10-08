// The header of the plain pages (Release updates): same brand, links and single Subscribe button as the start page.
import { site } from '../lib/content';
import { linkClick } from '../lib/router';
import { useApp } from '../lib/store';
import { openSubscribe } from '../lib/subscribe';
import { exploreMap } from './Landing';
import { HoverButton } from './ui/hover-glow-button';
import { cn } from '@/lib/utils';

export default function SiteHeader({ current }: { current?: 'updates' }) {
  const subscribed = useApp((s) => s.subscribed);
  return (
    <header className="mx-auto flex h-24 max-w-7xl items-center justify-between px-6 max-sm:h-auto max-sm:flex-wrap max-sm:pt-6 md:px-[6.5%]">
      <a href="/" onClick={linkClick} className="flex items-center gap-3" aria-label={`${site.title} home`}>
        <svg viewBox="0 0 38 38" className="h-9 w-9" aria-hidden>
          <defs>
            <radialGradient id="hdr-logo" cx="30%" cy="20%">
              <stop stopColor="#c4b5fd" />
              <stop offset="1" stopColor="#7c3aed" />
            </radialGradient>
          </defs>
          <circle cx="23" cy="15" r="14" fill="url(#hdr-logo)" />
          <circle cx="10" cy="27" r="8" fill="#8b5cf6" />
        </svg>
        <span className="flex flex-col leading-none">
          <span className="text-2xl font-semibold tracking-tight text-slate-950">{site.title}</span>
          <span className="mt-1 text-[8px] font-medium uppercase tracking-[0.24em] text-violet-400">live data map</span>
        </span>
      </a>
      <nav className="flex items-center gap-8 text-[11px] uppercase tracking-[0.25em] max-sm:order-3 max-sm:mt-2 max-sm:w-full max-sm:gap-6 max-sm:text-[9px] max-sm:tracking-[0.22em]" aria-label="Main navigation">
        <a
          href="/map"
          onClick={(e) => {
            e.preventDefault();
            exploreMap();
          }}
          className="py-3 text-[#5b4d83] transition-colors hover:text-violet-600"
        >
          Explore map
        </a>
        <a href="/updates" onClick={linkClick} className={cn('py-3 transition-colors hover:text-violet-600', current === 'updates' ? 'font-medium text-violet-700' : 'text-[#5b4d83]')}>
          Release updates
        </a>
      </nav>
      <HoverButton
        onClick={() => openSubscribe()}
        disabled={subscribed}
        className="rounded-full px-6 py-4 indent-[0.22em] text-[11px] font-medium uppercase tracking-[0.22em] shadow-[0_10px_24px_-10px_#7c3aed99] disabled:bg-violet-100 disabled:text-violet-700 disabled:shadow-none max-sm:px-4 max-sm:py-3 max-sm:indent-[0.2em] max-sm:text-[9px] max-sm:tracking-[0.2em]"
      >
        {subscribed ? 'Subscribed ✓' : 'Subscribe'}
      </HoverButton>
    </header>
  );
}
