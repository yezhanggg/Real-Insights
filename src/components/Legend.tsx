// A small key over the map for each layer that is on.
import { X } from 'lucide-react';
import { getLayer } from '../lib/content';
import { formatValue } from '../lib/format';
import { legendOf } from '../lib/map';
import { useApp } from '../lib/store';

export default function Legend() {
  const active = useApp((s) => s.layers);
  const set = useApp((s) => s.set);
  const list = active.map(getLayer).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="pointer-events-auto flex w-60 flex-col gap-2 max-[859px]:w-48" aria-label="Map key">
      {list.map((l) => {
        const g = legendOf(l!);
        const fmt = l!.legend?.format;
        const lab = (v: string | number) => (typeof v === 'number' ? formatValue(v, fmt ?? 'number') : v);
        return (
          <div key={l!.id} className="rounded-2xl bg-white/95 px-3 py-2.5 shadow-lg ring-1 ring-black/5 backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <span className="text-small font-semibold leading-tight text-slate-900">{l!.legend?.title ?? l!.title}</span>
              <button aria-label={`Hide ${l!.title}`} onClick={() => set({ layers: active.filter((x) => x !== l!.id) })} className="rounded-md p-0.5 text-slate-400 hover:bg-stone-100 hover:text-slate-900">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {g.kind === 'ramp' ? (
              <>
                <div className="mt-2 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${g.items.map((i) => i.color).join(',')})` }} />
                <div className="tnum mt-1 flex justify-between text-caption text-slate-600">
                  <span>{lab(g.items[0].label)}</span>
                  <span>{lab(g.items[g.items.length - 1].label)}</span>
                </div>
              </>
            ) : g.kind === 'single' ? null : (
              <ul className="mt-2 grid gap-1">
                {g.items.map((i) => (
                  <li key={String(i.label)} className="flex items-center gap-2 text-caption text-slate-700">
                    <span className="h-3 w-3 shrink-0 rounded" style={{ background: i.color }} />
                    {lab(i.label)}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-1.5 truncate text-[11px] text-slate-500 max-[859px]:hidden">{l!.source.name}</div>
          </div>
        );
      })}
    </div>
  );
}
