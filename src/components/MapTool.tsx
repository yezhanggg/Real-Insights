// The map tool, laid out like the VisionPitts Explore screen: the map fills the window and everything floats on it.
// Top-left: Home. Left: the Data panel (layers and map settings). Right: the question box, with the details panel
// under it. Bottom-left: the legend. Top-center: a one-line hint until a layer is on.
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Home, Info, LocateFixed, Lock, MapPinned, MousePointerClick, Search, X } from 'lucide-react';
import { getLayer, layers, site } from '../lib/content';
import { bytes, coords, cx, formatValue, longDate } from '../lib/format';
import { navigate } from '../lib/router';
import { openSubscribe } from '../lib/subscribe';
import { useApp } from '../lib/store';
import type { Layer, View } from '../lib/types';
import MapStage from './MapStage';
import ChatBox from './ChatBox';
import Legend from './Legend';
import { PanelFrame, Rail, Section, SPRING_TAB, Switch } from './primitives';
import { Badge } from './ui';

export function viewOf(l: Layer): View | null {
  if (l.place) return l.place;
  if (!l.bbox) return null;
  const [w, s, e, n] = l.bbox;
  const span = Math.max(e - w, n - s, 0.0005);
  return { lng: (w + e) / 2, lat: (s + n) / 2, zoom: Math.max(3, Math.min(15.5, Math.log2(360 / span) - 0.2)), pitch: 45, bearing: -12 };
}

const locked = () => site.gate === 'data' && !useApp.getState().subscribed;

/** Turns a layer on (flying to it and showing its details) or off. */
export function toggleLayer(id: string, on: boolean) {
  const s = useApp.getState();
  if (on && locked()) return openSubscribe(`/map/${id}`);
  if (!on) return s.set({ layers: s.layers.filter((x) => x !== id), focus: s.focus === id ? null : s.focus });
  const l = getLayer(id);
  if (!l) return;
  s.set({ layers: s.layers.includes(id) ? s.layers : [...s.layers, id], focus: id, feature: null, panelOpen: true });
  const v = viewOf(l);
  if (v) s.flyTo(v);
}

// ------------------------------------------------------------------ left panel
function LayersSection() {
  const active = useApp((s) => s.layers);
  const focus = useApp((s) => s.focus);
  const set = useApp((s) => s.set);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return layers;
    return layers.filter((l) => {
      const hay = `${l.title} ${l.dek} ${l.about} ${l.source.name} ${l.tags.join(' ')} ${(l.fields ?? []).map((f) => f.name).join(' ')}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [q]);

  if (!layers.length)
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 px-3 py-3 text-small text-slate-600">
        No datasets are published yet. The first one is on its way.
      </div>
    );
  return (
    <div className="space-y-1.5">
      {layers.length > 5 && (
        <div className="flex items-center gap-2 rounded-xl bg-white px-2.5 ring-1 ring-stone-200/80 focus-within:ring-2 focus-within:ring-violet-300">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a dataset" aria-label="Find a dataset" className="w-full bg-transparent py-1.5 text-small outline-none placeholder:text-slate-400" />
        </div>
      )}
      {shown.map((l) => (
        <Switch
          key={l.id}
          on={active.includes(l.id)}
          onChange={(on) => toggleLayer(l.id, on)}
          label={
            <span className="flex flex-wrap items-center gap-1.5">
              {l.title}
              {l.example && <Badge tone="amber">example</Badge>}
            </span>
          }
          caption={`${l.source.name}${l.updated ? ` · ${longDate(l.updated)}` : ''}`}
          right={
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                set({ focus: l.id, feature: null, panelOpen: true });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  set({ focus: l.id, feature: null, panelOpen: true });
                }
              }}
              className={cx('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md transition', focus === l.id ? 'bg-violet-50 text-violet-700' : 'text-slate-400 hover:bg-stone-100 hover:text-slate-900')}
              aria-label={`About ${l.title}`}
              title="About this dataset"
            >
              {locked() ? <Lock className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
            </span>
          }
        />
      ))}
      {shown.length === 0 && <p className="px-1 py-2 text-small text-slate-500">No dataset matches "{q}".</p>}
    </div>
  );
}

function LookSection() {
  const look = useApp((s) => s.look);
  const set = useApp((s) => s.set);
  const row = (id: keyof typeof look, label: string, caption: string) => <Switch on={look[id]} onChange={(on) => set({ look: { ...look, [id]: on } })} label={label} caption={caption} />;
  return (
    <div className="space-y-1.5">
      {row('buildings', 'Buildings', '3D footprints from OpenStreetMap')}
      {row('terrain', 'Terrain', '3D relief (USGS 3DEP)')}
      {row('hillshade', 'Hill shading', 'Shaded relief over the basemap')}
      <p className="px-1 pt-1 text-caption text-slate-600">Drag with the right mouse button (or two fingers) to tilt and turn the map.</p>
    </div>
  );
}

// ------------------------------------------------------------------ right panel
function EmptyDetails() {
  return (
    <div className="grid h-full min-h-[240px] place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
          <MapPinned className="h-5 w-5" />
        </div>
        <h2 className="mt-3 font-display text-lead font-bold text-slate-900">Nothing selected yet</h2>
        <p className="mx-auto mt-1 max-w-[30ch] text-small text-slate-600">Turn on a dataset in the Data panel, then click any shape on the map for its numbers.</p>
      </div>
    </div>
  );
}

function FeatureCard() {
  const f = useApp((s) => s.feature)!;
  const set = useApp((s) => s.set);
  const flyTo = useApp((s) => s.flyTo);
  const l = getLayer(f.layer);
  if (!l) return null;
  const spec = l.popup;
  const title = spec?.title ? f.props[spec.title] : undefined;
  const fields = spec?.fields ?? Object.keys(f.props).slice(0, 12).map((field) => ({ field, label: field, format: undefined }));
  return (
    <div className="border-b border-stone-200/70 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-caption font-semibold uppercase tracking-wide text-violet-700">{l.title}</div>
          <div className="mt-0.5 font-display text-title font-bold leading-tight text-slate-900">{title != null ? String(title) : 'Selected shape'}</div>
          <div className="tnum mt-0.5 text-caption text-slate-500">{coords(f.lat, f.lng, 4)}</div>
        </div>
        <button onClick={() => set({ feature: null })} className="rounded-lg p-1 text-slate-400 hover:bg-stone-100 hover:text-slate-900" aria-label="Clear the selection" title="Clear the selection">
          <X className="h-4 w-4" />
        </button>
      </div>
      <dl className="mt-3 divide-y divide-stone-100 rounded-xl bg-stone-50/70 px-3 ring-1 ring-stone-200/70">
        {fields.map((x) => (
          <div key={x.field} className="flex items-baseline justify-between gap-3 py-1.5 text-small">
            <dt className="text-slate-600">{x.label ?? x.field}</dt>
            <dd className="tnum text-right font-semibold text-slate-900">{formatValue(f.props[x.field], x.format)}</dd>
          </div>
        ))}
      </dl>
      <button onClick={() => flyTo({ lng: f.lng, lat: f.lat, zoom: 15.5, pitch: 55, bearing: -20 })} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-caption font-semibold text-slate-600 ring-1 ring-stone-200 transition hover:text-slate-900 hover:ring-violet-300">
        <LocateFixed className="h-3.5 w-3.5" /> Zoom here
      </button>
    </div>
  );
}

function LayerDetails({ l }: { l: Layer }) {
  const active = useApp((s) => s.layers);
  const flyTo = useApp((s) => s.flyTo);
  const on = active.includes(l.id);
  const pill = 'inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-caption font-semibold text-slate-600 ring-1 ring-stone-200 transition hover:text-slate-900 hover:ring-violet-300';
  return (
    <div className="p-4">
      <div className="text-caption font-semibold uppercase tracking-wide text-slate-500">About this dataset</div>
      <h3 className="mt-1 flex flex-wrap items-center gap-1.5 font-display text-lead font-bold leading-snug text-slate-900">
        {l.title}
        {l.example && <Badge tone="amber">example · dev only</Badge>}
      </h3>
      {l.dek && <p className="mt-1 text-small text-slate-600">{l.dek}</p>}
      {l.about && <p className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-small text-slate-600 ring-1 ring-stone-200/80">{l.about}</p>}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-small">
        <div className="col-span-2">
          <dt className="text-caption font-semibold text-slate-500">Source</dt>
          <dd className="text-slate-800">
            {l.source.url ? (
              <a href={l.source.url} target="_blank" rel="noreferrer" className="font-medium text-violet-700 hover:underline">
                {l.source.name}
              </a>
            ) : (
              l.source.name
            )}
          </dd>
        </div>
        {l.updated && (
          <div>
            <dt className="text-caption font-semibold text-slate-500">Updated</dt>
            <dd className="text-slate-800">{longDate(l.updated)}</dd>
          </div>
        )}
        {l.count != null && (
          <div>
            <dt className="text-caption font-semibold text-slate-500">Features</dt>
            <dd className="tnum text-slate-800">
              {l.count.toLocaleString()} {l.geometry?.toLowerCase()}
              {l.count === 1 ? '' : 's'}
            </dd>
          </div>
        )}
        {l.license && (
          <div className="col-span-2">
            <dt className="text-caption font-semibold text-slate-500">License</dt>
            <dd className="text-slate-800">{l.license}</dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {!on && (
          <button onClick={() => toggleLayer(l.id, true)} className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1 text-caption font-semibold text-white shadow-sm shadow-violet-500/30 hover:bg-violet-700">
            Show on the map
          </button>
        )}
        <button
          onClick={() => {
            const v = viewOf(l);
            if (v) flyTo(v);
          }}
          className={pill}
        >
          <LocateFixed className="h-3.5 w-3.5" /> Go to
        </button>
        {l.data &&
          (locked() ? (
            <button onClick={() => openSubscribe(`/map/${l.id}`)} className={pill}>
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          ) : (
            <a href={l.data} download className={pill}>
              <Download className="h-3.5 w-3.5" /> GeoJSON {l.bytes ? <span className="tnum text-slate-400">{bytes(l.bytes)}</span> : null}
            </a>
          ))}
      </div>
    </div>
  );
}

function Details() {
  const feature = useApp((s) => s.feature);
  const focus = useApp((s) => s.focus);
  const l = (feature && getLayer(feature.layer)) || (focus && getLayer(focus)) || null;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={`${feature ? `${feature.lng},${feature.lat}` : ''}|${l?.id ?? ''}`} className={l ? undefined : 'h-full'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
        {feature && <FeatureCard />}
        {l ? <LayerDetails l={l} /> : <EmptyDetails />}
      </motion.div>
    </AnimatePresence>
  );
}

// ------------------------------------------------------------------ the screen
export default function MapTool({ focus }: { focus?: string }) {
  const set = useApp((s) => s.set);
  const railOpen = useApp((s) => s.railOpen);
  const panelOpen = useApp((s) => s.panelOpen);
  const active = useApp((s) => s.layers);
  const hintClosed = useApp((s) => s.hintClosed);

  useEffect(() => {
    document.title = `Map · ${site.title}`;
    return () => {
      document.title = `${site.title} · Real estate data on a live map`;
    };
  }, []);

  // /map/<layer>: open with that layer on and the map on it (the first flight replaces the globe intro).
  useEffect(() => {
    const l = focus ? getLayer(focus) : undefined;
    if (!l) return;
    toggleLayer(l.id, true);
  }, [focus]);

  // Keep the address in step with the dataset in view, so it can be shared.
  useEffect(() => {
    const want = active.length ? `/map/${active[active.length - 1]}` : '/map';
    if (location.pathname !== want) navigate(want, { replace: true });
  }, [active]);

  const showHint = !active.length && !hintClosed;

  return (
    <div className="relative h-full overflow-hidden">
      <MapStage />

      <div className="absolute left-3 top-3 z-30 flex items-center gap-1.5">
        <motion.a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          transition={SPRING_TAB}
          title={`Back to the ${site.title} start page`}
          className="flex items-center gap-1.5 rounded-xl bg-white/95 px-3 py-2 text-small font-semibold text-slate-700 shadow-lg ring-1 ring-black/5 backdrop-blur hover:bg-white hover:text-slate-900 max-sm:px-2.5"
        >
          <Home className="h-4 w-4" />
          <span className="max-sm:hidden">Home</span>
        </motion.a>
        <span className="flex items-center gap-2 rounded-xl bg-white/95 py-1.5 pl-1.5 pr-3 shadow-lg ring-1 ring-black/5 backdrop-blur max-sm:hidden">
          <img src="/favicon.svg" alt="" className="h-6 w-6 rounded-md" />
          <span className="font-display text-small font-bold text-slate-900">{site.title}</span>
        </span>
      </div>

      <Rail title="Data" open={railOpen} onToggle={(o) => set({ railOpen: o })}>
        <Section title="Datasets" sub="Turn on as many as you like">
          <LayersSection />
        </Section>
        <Section title="Settings" sub="How the map looks" defaultOpen={false}>
          <LookSection />
        </Section>
      </Rail>

      {/* Right column: the search-and-question box on top, the details (or their small tab) underneath. Phones: a sheet along the bottom. */}
      <div className="pointer-events-none absolute bottom-12 right-3 top-3 z-20 flex w-[440px] flex-col items-end gap-2 max-[1099px]:w-[380px] max-sm:inset-x-2 max-sm:bottom-2 max-sm:top-auto max-sm:max-h-[52vh] max-sm:w-auto">
        <ChatBox compact={typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches} />
        <PanelFrame title="Details" open={panelOpen} onToggle={(o) => set({ panelOpen: o })}>
          <Details />
        </PanelFrame>
      </div>

      <AnimatePresence>
        {showHint && (
          <motion.div key="hint" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="absolute left-1/2 top-3 z-20 -translate-x-1/2 max-[1099px]:top-16 max-sm:hidden" role="status">
            <div className="flex items-center gap-2 rounded-full bg-slate-900/90 py-1.5 pl-3.5 pr-1.5 text-small font-medium text-white shadow-lg backdrop-blur">
              <MousePointerClick className="h-4 w-4 shrink-0 text-violet-200" />
              <span className="whitespace-nowrap">Turn on a dataset, then click any shape for its numbers</span>
              <button onClick={() => set({ hintClosed: true })} className="grid h-6 w-6 place-items-center rounded-full text-white/70 hover:bg-white/15 hover:text-white" aria-label="Hide this tip" title="Hide this tip">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cx('pointer-events-none absolute bottom-3 left-3 z-20 max-sm:hidden', railOpen && 'max-[1099px]:hidden')}>
        <Legend />
      </div>
    </div>
  );
}
