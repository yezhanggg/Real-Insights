// Screens: the start page (no map), Release updates, and the map tool. Subscribe is a pop-up over any of them.
// With `gate: map` (content/site.yaml), a not-yet-subscribed reader who opens a map link sees the start page with the
// pop-up open, and goes on into the map once they're in.
import { useEffect } from 'react';
import { site } from './lib/content';
import { linkClick, parse, usePath } from './lib/router';
import { useApp } from './lib/store';
import { openSubscribe } from './lib/subscribe';
import Landing from './components/Landing';
import Updates from './components/Updates';
import MapTool from './components/MapTool';
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
  const asked = route.name === 'map' && site.gate === 'map' && !subscribed;
  const target = route.name === 'map' ? `/map${route.layer ? `/${route.layer}` : ''}` : null;

  useEffect(() => {
    if (asked && target) openSubscribe(target);
  }, [asked, target]);
  useEffect(() => {
    if (route.name === 'subscribe') openSubscribe(route.next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.name]);

  let screen: React.ReactNode;
  if (route.name === 'map' && !asked) screen = <MapTool focus={route.layer} />;
  else if (route.name === 'updates') screen = <Updates />;
  else if (route.name === 'missing') screen = <Missing />;
  else screen = <Landing />;
  return (
    <>
      {screen}
      <SubscribeDialog />
    </>
  );
}
