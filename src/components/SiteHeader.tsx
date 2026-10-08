// The header of the plain pages (Insights, Coming soon): same name, links and single Subscribe button as the start page.
import { site } from '../lib/content';
import { linkClick } from '../lib/router';
import { useApp } from '../lib/store';
import { openSubscribe } from '../lib/subscribe';
import { exploreMap } from './Landing';
import { SubscribeButton } from './ui/3d-button';
import { BrandMark } from './ui/text-loop';
import { cn } from '@/lib/utils';

export default function SiteHeader({ current }: { current?: 'map' | 'updates' }) {
  const subscribed = useApp((s) => s.subscribed);
  return (
    <header className="mx-auto flex h-24 max-w-7xl items-center justify-between px-6 max-sm:h-auto max-sm:flex-wrap max-sm:pt-6 md:px-[6.5%]">
      <a href="/" onClick={linkClick} aria-label={`${site.title} home`}>
        <BrandMark name={site.title} className="text-2xl font-semibold tracking-tight text-slate-950" />
      </a>
      <nav className="flex items-center gap-8 text-[11px] uppercase tracking-[0.25em] max-sm:order-3 max-sm:mt-2 max-sm:w-full max-sm:gap-6 max-sm:text-[9px] max-sm:tracking-[0.22em]" aria-label="Main navigation">
        <a
          href="/map"
          onClick={(e) => {
            e.preventDefault();
            exploreMap();
          }}
          className={cn('py-3 transition-colors hover:text-violet-600', current === 'map' ? 'font-medium text-violet-700' : 'text-[#5b4d83]')}
        >
          Explore map
        </a>
        <a href="/updates" onClick={linkClick} className={cn('py-3 transition-colors hover:text-violet-600', current === 'updates' ? 'font-medium text-violet-700' : 'text-[#5b4d83]')}>
          Insights
        </a>
      </nav>
      <SubscribeButton onClick={() => openSubscribe()} done={subscribed} />
    </header>
  );
}
