// The start page: the Orbit hero (a data globe, no map) and the footer. Explore map and Insights are links to their
// own pages (before launch, both show the "Coming soon" page); Subscribe, the one button, opens the pop-up.
import { Suspense, lazy, useEffect } from 'react';
import { site } from '../lib/content';
import { navigate } from '../lib/router';
import { useApp } from '../lib/store';
import { openSubscribe } from '../lib/subscribe';
import SiteFooter from './ui/footer-1';

// The 3D hero (three.js) loads in its own chunk, so the map tool never pays for it.
const OrbitHero = lazy(() => import('./ui/orbit-delivery-hero'));

/** Into the map, or the Subscribe pop-up first when the site asks for an email before the map. Before launch the map's
 * address shows the "Coming soon" page, and nothing is asked. */
export function exploreMap(path = '/map') {
  if (site.launched && site.gate === 'map' && !useApp.getState().subscribed) return openSubscribe(path);
  navigate(path);
  window.scrollTo({ top: 0 });
}

export default function Landing() {
  const subscribed = useApp((s) => s.subscribed);
  useEffect(() => {
    document.title = `${site.title} · Real estate data on a live map`;
  }, []);
  return (
    <div className="min-h-full bg-[#fbfaf8]">
      <Suspense fallback={<div className="h-[100svh] min-h-[760px] bg-[radial-gradient(ellipse_at_6%_15%,#fffdfb_0%,#fcfbff_38%,#f3eeff_100%)]" />}>
        <OrbitHero
          brand={site.title}
          subscribed={subscribed}
          onExplore={() => exploreMap()}
          onUpdates={() => {
            navigate('/updates');
            window.scrollTo({ top: 0 });
          }}
          onSubscribe={() => openSubscribe()}
        />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
