// The live map of the map tool. Views steer it through the store (camera, layers, look, pins); a click on a data
// layer selects that shape (violet outline) and opens its details in the right panel.
import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getLayer, site } from '../lib/content';
import { buildLayers, layerIds, loadBasemap, loadDem, setupScene, VIOLET } from '../lib/map';
import { coords } from '../lib/format';
import { useApp, type MarkerSpec } from '../lib/store';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export default function MapStage() {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [painted, setPainted] = useState(false);
  const [readout, setReadout] = useState({ lat: site.home.lat, lng: site.home.lng, zoom: site.home.zoom });
  const firstSymbol = useRef<string | undefined>(undefined);
  const added = useRef(new Set<string>());
  const markerEls = useRef(new Map<string, { m: maplibregl.Marker; key: string }>());
  /** The camera request the opening flight already went to, so it is not flown twice. */
  const introKey = useRef<number | null>(null);

  const camera = useApp((s) => s.camera);
  const activeLayers = useApp((s) => s.layers);
  const markers = useApp((s) => s.markers);
  const agentPins = useApp((s) => s.agentPins);
  const look = useApp((s) => s.look);
  const feature = useApp((s) => s.feature);

  // ------------------------------------------------------------ create, then fly in from the globe
  useEffect(() => {
    let disposed = false;
    Promise.all([loadBasemap(), loadDem()]).then(([style, dem]) => {
      if (disposed || !el.current) return;
      const requested = useApp.getState().camera;
      introKey.current = requested?.key ?? null;
      const target = requested ?? site.home;
      const intro = !reduceMotion();
      const map = new maplibregl.Map({
        container: el.current,
        style,
        center: intro ? [target.lng - 40, target.lat - 4] : [target.lng, target.lat],
        zoom: intro ? 1.6 : target.zoom,
        pitch: intro ? 0 : target.pitch,
        bearing: intro ? 0 : target.bearing,
        maxPitch: 78,
        attributionControl: { compact: true, customAttribution: [dem.attribution, 'Search © OpenStreetMap / Photon'] },
        canvasContextAttributes: { antialias: true },
        fadeDuration: 200,
      });
      mapRef.current = map;
      (window as unknown as { __map?: MLMap }).__map = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
      // Gentler scroll and trackpad zoom than MapLibre's default.
      map.scrollZoom.setWheelZoomRate(1 / 900);
      map.scrollZoom.setZoomRate(1 / 220);
      map.on('style.load', () => {
        if (intro) {
          try {
            map.setProjection({ type: 'globe' });
          } catch {
            /* older engines */
          }
        }
        firstSymbol.current = setupScene(map, dem);
        applyLook(map, useApp.getState().look);
        map.addSource('ri-selected', { type: 'geojson', data: EMPTY });
        map.addLayer({ id: 'ri-selected-casing', type: 'line', source: 'ri-selected', paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.9 } });
        map.addLayer({ id: 'ri-selected-line', type: 'line', source: 'ri-selected', paint: { 'line-color': VIOLET, 'line-width': 3 } });
        map.addLayer({ id: 'ri-selected-point', type: 'circle', source: 'ri-selected', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 9, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': VIOLET, 'circle-stroke-width': 3 } });
        setReady(true);
        if (intro) map.flyTo({ center: [target.lng, target.lat], zoom: target.zoom, pitch: target.pitch, bearing: target.bearing, duration: 5200, curve: 1.6, essential: true });
      });
      map.once('load', () => {
        setPainted(true);
        el.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      });
      setTimeout(() => setPainted(true), 6000);
      map.on('move', () => {
        const c = map.getCenter();
        setReadout({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
      });
      map.on('error', (e) => {
        const msg = String((e as { error?: Error }).error?.message ?? '');
        if (!/Failed to fetch|AJAXError|NetworkError|Load failed/.test(msg)) console.warn('[map]', msg);
      });
      const hits = (p: maplibregl.PointLike) => {
        const ids = useApp
          .getState()
          .layers.flatMap(layerIds)
          .filter((id) => map.getLayer(id));
        return ids.length ? map.queryRenderedFeatures(p, { layers: ids }) : [];
      };
      map.on('click', (e) => {
        const f = hits(e.point)[0];
        if (!f) return useApp.setState({ feature: null });
        const layer = f.layer.id.replace(/^ri-/, '').replace(/-line$/, '');
        useApp.setState({ feature: { layer, lng: e.lngLat.lng, lat: e.lngLat.lat, props: f.properties ?? {}, geometry: f.geometry ?? null }, focus: layer, panelOpen: true });
      });
      map.on('mousemove', (e) => {
        map.getCanvas().style.cursor = hits(e.point).length ? 'pointer' : '';
      });
    });
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      added.current.clear();
      markerEls.current.clear();
    };
  }, []);

  // ------------------------------------------------------------ camera
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !camera || camera.key === introKey.current) return;
    const target = { center: [camera.lng, camera.lat] as [number, number], zoom: camera.zoom, pitch: camera.pitch, bearing: camera.bearing };
    if (reduceMotion()) map.jumpTo(target);
    else map.flyTo({ ...target, duration: camera.duration ?? 2600, curve: 1.35, essential: true });
  }, [camera, ready]);

  // ------------------------------------------------------------ the look: buildings, terrain, hill shading
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready) applyLook(map, look);
  }, [look, ready]);

  // ------------------------------------------------------------ data layers: add on first use, then only toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const id of activeLayers) {
      if (added.current.has(id)) continue;
      const l = getLayer(id);
      if (!l) continue;
      const src = `ri-src-${id}`;
      if (l.tiles) map.addSource(src, { type: 'raster', tiles: [l.tiles], tileSize: 256, attribution: l.source.name });
      else map.addSource(src, { type: 'geojson', data: l.data!, attribution: l.source.name });
      // Flat layers sit under the 3D buildings and labels; extrusions stand with the buildings.
      const before = l.style?.type === 'extrusion' ? firstSymbol.current : map.getLayer('buildings-3d') ? 'buildings-3d' : firstSymbol.current;
      for (const spec of buildLayers(l)) map.addLayer(spec, before);
      added.current.add(id);
    }
    for (const id of added.current) {
      const vis = activeLayers.includes(id) ? 'visible' : 'none';
      for (const lid of layerIds(id)) if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', vis);
    }
    const f = useApp.getState().feature;
    if (f && !activeLayers.includes(f.layer)) useApp.setState({ feature: null });
  }, [activeLayers, ready]);

  // ------------------------------------------------------------ the selected shape
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource('ri-selected') as maplibregl.GeoJSONSource | undefined;
    src?.setData(feature?.geometry ? { type: 'Feature', properties: {}, geometry: feature.geometry } : EMPTY);
  }, [feature, ready]);

  // ------------------------------------------------------------ pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const all: MarkerSpec[] = [...markers, ...agentPins.map((p, i) => ({ id: `agent-${i}`, lng: p.lng, lat: p.lat, mark: '', label: p.label, tone: 'agent' as const }))];
    const keep = new Set<string>();
    for (const s of all) {
      const key = `${s.lng},${s.lat},${s.mark},${s.label},${s.tone}`;
      keep.add(s.id);
      const have = markerEls.current.get(s.id);
      if (have && have.key === key) continue;
      have?.m.remove();
      const node = document.createElement('div');
      node.className = `pin pin-${s.tone ?? 'pin'}`;
      node.innerHTML = `<span class="pin-dot">${esc(s.mark)}</span>${s.label ? `<span class="pin-label">${esc(s.label)}</span>` : ''}`;
      const m = new maplibregl.Marker({ element: node, anchor: 'bottom' }).setLngLat([s.lng, s.lat]).addTo(map);
      markerEls.current.set(s.id, { m, key });
    }
    for (const [id, v] of markerEls.current) if (!keep.has(id)) (v.m.remove(), markerEls.current.delete(id));
  }, [markers, agentPins, ready]);

  useEffect(() => {
    if (!el.current) return;
    const ro = new ResizeObserver(() => mapRef.current?.resize());
    ro.observe(el.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="absolute inset-0 bg-[#eef0f2]">
      <div ref={el} className="h-full w-full" aria-label="Live map" role="region" />
      {!painted && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="shimmer-text text-body font-medium">Loading the live map…</span>
        </div>
      )}
      <div className="tnum pointer-events-none absolute bottom-2.5 right-14 z-10 rounded-lg bg-white/85 px-2 py-0.5 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-black/5 backdrop-blur max-sm:hidden" aria-hidden>
        {coords(readout.lat, readout.lng, 4)} · z {readout.zoom.toFixed(1)}
      </div>
    </div>
  );
}

function applyLook(map: MLMap, look: { buildings: boolean; terrain: boolean; hillshade: boolean }) {
  if (map.getLayer('buildings-3d')) map.setLayoutProperty('buildings-3d', 'visibility', look.buildings ? 'visible' : 'none');
  if (map.getLayer('hillshade')) map.setLayoutProperty('hillshade', 'visibility', look.hillshade ? 'visible' : 'none');
  if (look.terrain && map.getSource('dem-terrain')) map.setTerrain({ source: 'dem-terrain', exaggeration: 1.15 });
  else map.setTerrain(null);
}
