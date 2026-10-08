// Basemap, elevation, and turning a layer's YAML style into MapLibre layers.
// The basemap, terrain, sky and buildings follow VisionPitts (same author, same look).
import type { ExpressionSpecification, LayerSpecification, Map as MLMap, StyleSpecification } from 'maplibre-gl';
import type { ColorSpec, Layer } from './types';

export const BASEMAP_URL = 'https://tiles.openfreemap.org/styles/positron';
const AWS_TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const MAPTERHORN_TILEJSON = 'https://tiles.mapterhorn.com/tilejson.json';

/** Shared with styles.css: violet is "here" (pins, selection) and the default data color. */
export const VIOLET = 'rgb(124,58,237)';
export const NO_DATA = '#e7e5e4';

// ------------------------------------------------------------------ basemap
const FALLBACK: StyleSpecification = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eef0f2' } }] };

let stylePromise: Promise<StyleSpecification> | null = null;
export function loadBasemap(): Promise<StyleSpecification> {
  stylePromise ??= (async () => {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(BASEMAP_URL, { signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error(String(r.status));
      const style = (await r.json()) as StyleSpecification;
      return style;
    } catch (e) {
      console.warn('[map] basemap unavailable, drawing a plain background', e);
      return FALLBACK;
    }
  })();
  return stylePromise;
}

// ------------------------------------------------------------------ elevation
export interface Dem {
  tiles: string[];
  tileSize: number;
  maxzoom: number;
  attribution: string;
}
const AWS_DEM: Dem = { tiles: [AWS_TERRARIUM], tileSize: 256, maxzoom: 15, attribution: 'Elevation: AWS Terrain Tiles' };
let demPromise: Promise<Dem> | null = null;
/** Mapterhorn (USGS 3DEP in the US, 512 px tiles); AWS Terrarium when it does not answer in 4 s. */
export function loadDem(): Promise<Dem> {
  demPromise ??= (async () => {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch(MAPTERHORN_TILEJSON, { signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { tiles?: string[]; tileSize?: number; maxzoom?: number; encoding?: string };
      if (!j.tiles?.length || (j.encoding && j.encoding !== 'terrarium')) throw new Error('unexpected tilejson');
      return { tiles: j.tiles, tileSize: j.tileSize ?? 512, maxzoom: Math.min(j.maxzoom ?? 16, 16), attribution: '© Mapterhorn · USGS 3DEP' };
    } catch {
      return AWS_DEM;
    }
  })();
  return demPromise;
}

// ------------------------------------------------------------------ the scene: sky, terrain, hillshade, 3D buildings
export function setupScene(map: MLMap, dem: Dem) {
  try {
    map.setSky({
      'sky-color': '#dfe9f3',
      'horizon-color': '#f4efe8',
      'fog-color': '#f6f4f1',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.25,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 7, 1, 10, 0],
    } as never);
  } catch {
    /* older engines */
  }
  const layers = map.getStyle().layers ?? [];
  const firstSymbol = layers.find((l) => l.type === 'symbol')?.id;
  for (const l of layers) if (l.type === 'symbol' && /poi|housenum/.test(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none');

  const demSrc = { type: 'raster-dem' as const, tiles: dem.tiles, encoding: 'terrarium' as const, tileSize: dem.tileSize, maxzoom: dem.maxzoom };
  map.addSource('dem-terrain', demSrc);
  map.addSource('dem-shade', demSrc);
  map.addLayer(
    { id: 'hillshade', type: 'hillshade', source: 'dem-shade', paint: { 'hillshade-exaggeration': 0.18, 'hillshade-shadow-color': '#6b6258', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#8a8177' } },
    firstSymbol,
  );
  map.setTerrain({ source: 'dem-terrain', exaggeration: 1.15 });

  if (map.getSource('openmaptiles')) {
    map.addLayer(
      {
        id: 'buildings-3d',
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': '#e7e5e4',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.6, ['coalesce', ['get', 'render_height'], 0]],
          'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.6, ['coalesce', ['get', 'render_min_height'], 0]],
          'fill-extrusion-opacity': 0.75,
        },
      },
      firstSymbol,
    );
  }
  return firstSymbol;
}

// ------------------------------------------------------------------ data layers
export const layerIds = (id: string) => [`ri-${id}`, `ri-${id}-line`];

function colorExpr(c: ColorSpec | undefined, fallback = VIOLET): ExpressionSpecification | string {
  if (!c) return fallback;
  if (typeof c === 'string') return c;
  const v: unknown = ['to-number', ['get', c.field], -1e12];
  if ('stops' in c) {
    const out: unknown[] = ['interpolate', ['linear'], v];
    for (const [s, col] of c.stops) out.push(s, col);
    return ['case', ['==', ['typeof', ['get', c.field]], 'number'], out, NO_DATA] as unknown as ExpressionSpecification;
  }
  if ('breaks' in c) {
    const out: unknown[] = ['step', v, c.colors[0]];
    c.breaks.forEach((b, i) => out.push(b, c.colors[i + 1] ?? c.colors[c.colors.length - 1]));
    return ['case', ['==', ['typeof', ['get', c.field]], 'number'], out, NO_DATA] as unknown as ExpressionSpecification;
  }
  const out: unknown[] = ['match', ['to-string', ['get', c.field]]];
  for (const [k, col] of Object.entries(c.categories)) out.push(k, col);
  out.push(c.other ?? NO_DATA);
  return out as unknown as ExpressionSpecification;
}

/** The MapLibre layers that draw one journal layer. Fills get an outline layer on top. */
export function buildLayers(l: Layer): LayerSpecification[] {
  const s = l.style ?? {};
  const src = `ri-src-${l.id}`;
  const [id, lineId] = layerIds(l.id);
  const geom = l.geometry ?? '';
  const type = s.type ?? (geom === 'Raster' ? 'raster' : geom === 'Point' ? 'circle' : geom === 'LineString' ? 'line' : 'fill');
  const color = colorExpr(s.color) as never;
  switch (type) {
    case 'raster':
      return [{ id, type: 'raster', source: src, paint: { 'raster-opacity': s.opacity ?? 0.8 } }];
    case 'line':
      return [{ id, type: 'line', source: src, paint: { 'line-color': color, 'line-width': s.width ?? 2.5, 'line-opacity': s.opacity ?? 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round' } }];
    case 'circle': {
      const r = s.radius;
      const radius = typeof r === 'object' ? (['interpolate', ['linear'], ['to-number', ['get', r.field], 0], ...r.stops.flat()] as never) : (r ?? 6);
      return [{ id, type: 'circle', source: src, paint: { 'circle-color': color, 'circle-radius': radius, 'circle-opacity': s.opacity ?? 0.9, 'circle-stroke-color': s.outline ?? '#ffffff', 'circle-stroke-width': 1.2, 'circle-pitch-alignment': 'map' } }];
    }
    case 'heatmap':
      return [
        {
          id,
          type: 'heatmap',
          source: src,
          paint: {
            'heatmap-opacity': s.opacity ?? 0.75,
            'heatmap-radius': typeof s.radius === 'number' ? s.radius : 18,
            'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(253,244,227,0)', 0.25, '#fbdcaa', 0.5, '#f6b26b', 0.75, '#cc5234', 1, '#8f2d2a'],
          },
        },
      ];
    case 'extrusion': {
      const h = s.height;
      const height = typeof h === 'number' ? h : h ? (['*', ['to-number', ['get', h.field], 0], h.scale ?? 1] as never) : 50;
      return [{ id, type: 'fill-extrusion', source: src, paint: { 'fill-extrusion-color': color, 'fill-extrusion-height': height, 'fill-extrusion-opacity': s.opacity ?? 0.85, 'fill-extrusion-vertical-gradient': true } }];
    }
    default:
      return [
        { id, type: 'fill', source: src, paint: { 'fill-color': color, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, s.opacity ?? 0.72, 16, (s.opacity ?? 0.72) * 0.55] as never } },
        { id: lineId, type: 'line', source: src, paint: { 'line-color': s.outline ?? '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 14, 1.2] as never, 'line-opacity': 0.8 } },
      ];
  }
}

/** Legend entries for a layer: a gradient, steps or swatches. */
export function legendOf(l: Layer): { kind: 'ramp' | 'steps' | 'cats' | 'single'; items: { color: string; label: string | number }[] } {
  const c = l.style?.color;
  if (!c || typeof c === 'string') return { kind: 'single', items: [{ color: (c as string) ?? VIOLET, label: l.title }] };
  if ('stops' in c) return { kind: 'ramp', items: c.stops.map(([v, col]) => ({ color: col, label: v })) };
  if ('breaks' in c) return { kind: 'steps', items: c.colors.map((col, i) => ({ color: col, label: i === 0 ? `< ${c.breaks[0]}` : i === c.colors.length - 1 ? `≥ ${c.breaks[i - 1]}` : `${c.breaks[i - 1]}–${c.breaks[i]}` })) };
  return { kind: 'cats', items: [...Object.entries(c.categories).map(([k, col]) => ({ color: col, label: k })), ...(c.other ? [{ color: c.other, label: 'Other' }] : [])] };
}

export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
