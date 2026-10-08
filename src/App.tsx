// Screens: the start page (no map), Insights (/updates), and the map tool. Subscribe is a pop-up over any of them.
// With `gate: map` (content/site.yaml), a not-yet-subscribed reader who opens a map link sees the start page with the
// pop-up open, and goes on into the map once they're in. Before launch (`launched: false`), the map's and Insights'
// addresses show the "Coming soon" page instead, and nothing is asked.
import { useEffect } from 'react';
import { site } from './lib/content';
import { linkClick, parse, usePath } from './lib/router';
import { useApp } from './lib/store';
import { openSubscribe } from './lib/subscribe';
import ComingSoon from './components/ComingSoon';
import Landing from './components/Landing';
import Updates from './components/Updates';
import MapTool from './components/MapTool';
import SiteHeader from './components/SiteHeader';
import { SubscribeDialog } from './components/ui/subscribe-dialog';

function Missing() {
  return (
    <div className="grid min-h-full place-items-center bg-[#fbfaf8] p-8 text-center">
      <div>
        <p className="text-caption font-semibold uppercase tracking-wide text-violet-700">404</p>
        <h1 className="mt-2 font-display text-[34px] font-bold text-slate-900">Nothing at this address.</h1>
        <a href="/" onClick={linkClick} className="mt-3 inline-block font-semibold text-violet-700 hover:underline">
          Back to the start
        </a>
      </div>
    </div>
  );
}

export default function App() {
  const path = usePath();
  const route = parse(path);
  const subscribed = useApp((s) => s.subscribed);
  const soon = !site.launched && (route.name === 'map' || route.name === 'updates');
  const asked = site.launched && route.name === 'map' && site.gate === 'map' && !subscribed;
  const target = route.name === 'map' ? `/map${route.layer ? `/${route.layer}` : ''}` : null;

  useEffect(() => {
    if (asked && target) openSubscribe(target);
  }, [asked, target]);
  useEffect(() => {
    if (route.name === 'subscribe') openSubscribe(route.next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.name]);

  let screen: React.ReactNode;
  if (soon) screen = <ComingSoon what={route.name === 'map' ? 'map' : 'insights'} />;
  else if (route.name === 'map' && !asked) screen = <MapTool focus={route.layer} />;
  else if (route.name === 'updates') screen = <Updates />;
  else if (route.name === 'missing') screen = <Missing />;
  else screen = <Landing />;
  // One header, in the same place on every page. Only the map tool goes without: it is a full-screen tool.
  const mapTool = route.name === 'map' && !asked && !soon;
  return (
    <>
      {!mapTool && <SiteHeader current={route.name === 'map' ? 'map' : route.name === 'updates' ? 'updates' : undefined} />}
      {screen}
      <SubscribeDialog />
    </>
  );
}
