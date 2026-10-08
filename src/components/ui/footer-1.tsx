// The site footer, from the 21st.dev "footer-1" component: brand and newsletter on the left, link columns on the right.
// Plain links instead of next/link (this is a Vite app); only links that lead somewhere.
import type React from 'react';
import { site } from '@/lib/content';
import { linkClick } from '@/lib/router';
import { openSubscribe } from '@/lib/subscribe';
import { exploreMap } from '@/components/Landing';
import { SubscribeForm } from './footer-1-utils/subscribe-form';
import { NavLinks, type FooterSection } from './footer-1-utils/nav-links';

const inApp = (e: React.MouseEvent<HTMLAnchorElement>) => linkClick(e);

const footerSections: FooterSection[] = [
  {
    title: 'Explore',
    links: [
      { label: 'Explore map', href: '/map', onClick: (e) => (e.preventDefault(), exploreMap()) },
      { label: 'Insights', href: '/updates', onClick: inApp },
      { label: 'Ask the map', href: '/map', onClick: (e) => (e.preventDefault(), exploreMap()) },
    ],
  },
  {
    title: 'Data',
    links: [
      { label: 'All datasets', href: '/updates', onClick: inApp },
      { label: 'RSS feed', href: '/feed.xml' },
      { label: 'Subscribe', href: '/subscribe', onClick: (e) => (e.preventDefault(), openSubscribe()) },
    ],
  },
  {
    title: 'Connect',
    links: (site.links ?? []).map((l) => ({ label: l.label, href: l.url })),
  },
];

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-border bg-[#fbfaf8]">
      <div className="mx-auto max-w-7xl px-6 py-12 md:px-8 md:pb-16 md:pt-12">
        <div className="flex flex-col gap-8 sm:gap-12 xl:flex-row">
          <div className="space-y-6 xl:w-1/3 xl:max-w-sm">
            <a href="/" className="flex items-center gap-2 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              <svg viewBox="0 0 38 38" className="h-8 w-8" aria-hidden>
                <defs>
                  <radialGradient id="ftr-logo" cx="30%" cy="20%">
                    <stop stopColor="#c4b5fd" />
                    <stop offset="1" stopColor="#7c3aed" />
                  </radialGradient>
                </defs>
                <circle cx="23" cy="15" r="14" fill="url(#ftr-logo)" />
                <circle cx="10" cy="27" r="8" fill="#8b5cf6" />
              </svg>
              <span className="font-display text-xl font-semibold text-foreground">{site.title}</span>
            </a>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{site.tagline}</p>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>{site.launched ? 'Get new data by email:' : 'Get one email on launch day:'}</p>
              <SubscribeForm />
            </div>
          </div>
          <NavLinks sections={footerSections.filter((s) => s.links.length)} />
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 border-t border-border pt-8 md:flex-row md:justify-between">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {site.author}. Data keep their original licenses. Decision support only, not investment, legal or appraisal advice.
          </p>
          <div className="flex gap-6">
            <a href="/sitemap.xml" className="rounded text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
              Sitemap
            </a>
            <a href="/feed.xml" className="rounded text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
              RSS
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
