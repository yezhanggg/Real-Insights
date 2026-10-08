// The one header of the site: the name, the two links and the single Subscribe button. App.tsx mounts it once, over
// every page but the map tool, so it sits in exactly the same place everywhere and doesn't restart between pages.
// Each page leaves `--header-h` (src/styles.css) of room for it at the top.
import { site } from '../lib/content';
import { linkClick } from '../lib/router';
import { useApp } from '../lib/store';
import { openSubscribe } from '../lib/subscribe';
import { exploreMap } from './Landing';
import { SubscribeButton } from './ui/3d-button';
import { BrandMark } from './ui/text-loop';
import { cn } from '@/lib/utils';

const link = (on: boolean) => cn('pointer-events-auto whitespace-nowrap py-3 transition-colors hover:text-violet-600', on ? 'text-violet-700' : 'text-[#5b4d83]');

export default function SiteHeader({ current }: { current?: 'map' | 'updates' }) {
  const subscribed = useApp((s) => s.subscribed);
  return (
    // Only the name, links and button take the pointer; the rest lets it through to the page (the globe's crosshair).
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-[var(--header-h)] items-center justify-between px-[6.5%] max-[1150px]:px-[5%] max-[759px]:flex-wrap max-[759px]:content-start max-[759px]:px-[25px] max-[759px]:pt-6">
      <a href="/" onClick={linkClick} className="pointer-events-auto" aria-label={`${site.title} home`}>
        <BrandMark name={site.title} className="text-[27px] font-semibold tracking-[-1.2px] text-[#160e2b] max-[1150px]:text-2xl max-[759px]:text-[22px]" />
      </a>
      <nav
        className="absolute left-1/2 flex -translate-x-1/2 items-center gap-[42px] text-[11px] uppercase tracking-[0.25em] max-[1150px]:gap-6 max-[1150px]:text-[10px] max-[759px]:static max-[759px]:order-3 max-[759px]:mt-2 max-[759px]:w-full max-[759px]:translate-x-0 max-[759px]:text-[9px] max-[759px]:tracking-[0.22em]"
        aria-label="Main navigation"
      >
        <a
          href="/map"
          onClick={(e) => {
            e.preventDefault();
            exploreMap();
          }}
          className={link(current === 'map')}
        >
          Explore map
        </a>
        <a href="/updates" onClick={linkClick} className={link(current === 'updates')}>
          Insights
        </a>
      </nav>
      <SubscribeButton className="pointer-events-auto" onClick={() => openSubscribe()} done={subscribed} />
    </header>
  );
}
