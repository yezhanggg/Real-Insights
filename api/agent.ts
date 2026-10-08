// Vercel function: "Ask the map". A DeepSeek tool-calling loop grounded in what the site has published.
//
// Rules (also in docs/AGENT.md):
//  1. The model reads only the published catalog (dataset descriptions, field summaries) and what its tools return.
//  2. Every place it talks about goes on the map: it moves the camera, switches layers and drops pins through tools that
//     the browser carries out. Those tool calls are checked here (real layer ids, real coordinates).
//  3. It never invents a figure. Every number in an answer must appear in the catalog, a tool result or the
//     conversation; anything else is reported back as `unverified` and the page says so.
//  4. Keys stay on the server. Input is size-limited, requests are rate-limited per visitor, nothing is stored.
// The attribute is required: Vercel runs this file as a native ES module, and Node refuses a JSON import without it.
import content from '../src/generated/content.json' with { type: 'json' };

interface Req {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}
interface Res {
  status: (n: number) => { json: (b: unknown) => void };
  setHeader?: (k: string, v: string) => void;
}

type C = { site: { title: string; tagline: string; author: string; url: string }; layers: Layer[] };
interface Layer {
  id: string;
  title: string;
  dek: string;
  about: string;
  source: { name: string; url?: string };
  license: string | null;
  updated: string | null;
  tags: string[];
  count?: number;
  geometry?: string | null;
  bbox?: number[] | null;
  place?: { lng: number; lat: number; zoom: number } | null;
  fields?: { name: string; type: string; min?: number; max?: number; examples?: string[] }[];
  data?: string;
  example?: boolean;
}
const C = content as unknown as C;

export const LIMITS = { messages: 10, text: 1200, rounds: 5, perWindow: 30, windowMs: 10 * 60_000 };
const MAX_TOKENS = 700;

// ------------------------------------------------------------------ the catalog the model always sees
const r = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
export function catalogText(): string {
  const lines: string[] = [];
  lines.push(`SITE: ${C.site.title}. ${C.site.tagline} Author: ${C.site.author}. Address: ${C.site.url}`);
  lines.push(`\nDATASETS on the map (${C.layers.length}, newest first):`);
  if (!C.layers.length) lines.push('none published yet');
  for (const l of C.layers)
    lines.push(
      `- id=${l.id} | "${l.title}" | ${l.count ?? '?'} ${l.geometry ?? ''} features | source: ${l.source.name}${l.updated ? ` (updated ${l.updated})` : ''} | ${l.dek}${l.example ? ' | EXAMPLE (development only)' : ''}`,
    );
  return lines.join('\n');
}

export const SYSTEM = `You are the assistant inside ${C.site.title}, a free live map of real estate data published by ${C.site.author}. The live 3D map fills the screen behind you, with a Data panel on the left listing every dataset. You can move the map and turn datasets on.

Who you talk to: real estate professionals, planners, students and curious neighbors. Be warm, direct and plain-spoken, like a well-informed colleague. Short answers: at most 130 words, plain text, no markdown, no headings. Use lines starting with "• " only for short lists.

What you know: the CATALOG below (every published dataset) plus what your tools return. Use get_layer and search to read details. To read actual values from a dataset, use features_at (what is at a spot; geocode the spot first) or rank_features (highest or lowest areas). Never guess a value you could look up.

Rules:
1. Show, don't just tell. Whenever you talk about a place, call fly_to (use geocode first when you don't have coordinates). When a dataset is relevant, call show_layers. To mark several spots, call drop_pins. Then say in one short sentence what you did.
2. Never invent a number. Quote figures exactly as they appear in the catalog or tool results, and name the source. If the published data does not answer the question, say so plainly and suggest what is published instead. You may add brief general background from your own knowledge, but start that part with "In general," and state no figures in it.
3. Scope: real estate, housing, land, development, infrastructure, cities, and the data on this map. For anything else, say in one friendly sentence that you're here for maps and places.
4. Describe places and data, never people. No investment, legal, zoning or appraisal advice; you support decisions, you don't make them.
5. Items marked EXAMPLE exist only for development; mention that if you use one.

CATALOG
${catalogText()}`;

// ------------------------------------------------------------------ tools
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search',
      description: 'Keyword search across every published dataset (title, description, source, tags, field names). Returns the best matches with short snippets.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_layer',
      description: 'Everything published about one dataset: description, source, license, update date, extent, and each field with its type and range.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'features_at',
      description: 'Read a layer at a point: the polygon containing it, or for points and lines the nearest features within 400 m. Returns their published fields and values.',
      parameters: { type: 'object', properties: { layer: { type: 'string' }, lng: { type: 'number' }, lat: { type: 'number' } }, required: ['layer', 'lng', 'lat'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rank_features',
      description: 'Highest or lowest features of a layer by a numeric field, optionally only inside a bounding box. Returns each with its values and a center point to fly to or pin.',
      parameters: {
        type: 'object',
        properties: {
          layer: { type: 'string' },
          field: { type: 'string' },
          order: { type: 'string', enum: ['highest', 'lowest'] },
          limit: { type: 'number', description: '1 to 10' },
          bbox: { type: 'array', items: { type: 'number' }, description: 'optional [west, south, east, north]' },
        },
        required: ['layer', 'field'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'geocode',
      description: 'Find coordinates for a place name or address (OpenStreetMap). Use before fly_to when you do not already have coordinates.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fly_to',
      description: 'Move the live map. Zoom 4 = several states, 10 = a city, 13 = a neighborhood, 16 = a block. Pitch 0 is flat, 60 is a tilted 3D view.',
      parameters: {
        type: 'object',
        properties: {
          lng: { type: 'number' },
          lat: { type: 'number' },
          zoom: { type: 'number' },
          pitch: { type: 'number' },
          bearing: { type: 'number' },
          name: { type: 'string', description: 'Short place name shown to the reader' },
        },
        required: ['lng', 'lat'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_layers',
      description: 'Set which datasets are drawn on the map (replaces the current set; an empty list clears the map). Use ids from the catalog.',
      parameters: { type: 'object', properties: { layers: { type: 'array', items: { type: 'string' } } }, required: ['layers'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'drop_pins',
      description: 'Mark up to 8 spots on the map with short labels (replaces earlier pins).',
      parameters: {
        type: 'object',
        properties: { pins: { type: 'array', items: { type: 'object', properties: { lng: { type: 'number' }, lat: { type: 'number' }, label: { type: 'string' } }, required: ['lng', 'lat', 'label'] } } },
        required: ['pins'],
      },
    },
  },
];

type Action =
  | { type: 'fly_to'; view: { lng: number; lat: number; zoom: number; pitch: number; bearing: number; name?: string } }
  | { type: 'show_layers'; layers: string[] }
  | { type: 'drop_pins'; pins: { lng: number; lat: number; zoom: number; pitch: number; bearing: number; label: string }[] };

const num = (v: unknown, lo: number, hi: number, dflt?: number) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : dflt);
const okLng = (v: unknown) => num(v, -180, 180);
const okLat = (v: unknown) => num(v, -85, 85);

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
export function search(query: string) {
  const q = words(query);
  if (!q.length) return [];
  const docs = [
    ...C.layers.map((l) => ({ kind: 'layer', id: l.id, title: l.title, text: `${l.title} ${l.dek} ${l.about} ${l.source.name} ${l.tags.join(' ')} ${(l.fields ?? []).map((f) => f.name).join(' ')}` })),
  ];
  return docs
    .map((d) => {
      const hay = d.text.toLowerCase();
      const score = q.reduce((s, w) => s + (hay.includes(w) ? 1 + (d.title.toLowerCase().includes(w) ? 1 : 0) : 0), 0);
      const at = Math.max(0, q.map((w) => hay.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0);
      return { kind: d.kind, id: d.id, title: d.title, score, snippet: d.text.slice(Math.max(0, at - 120), at + 260) };
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

async function geocode(query: string) {
  const url = `https://photon.komoot.io/api/?limit=3&lang=en&q=${encodeURIComponent(query.slice(0, 200))}`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'vision-real (map journal)' } });
    if (!res.ok) return { error: `geocoder ${res.status}` };
    const j = (await res.json()) as { features?: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] };
    return {
      results: (j.features ?? []).map((f) => ({
        name: [f.properties.name, f.properties.street && `${f.properties.housenumber ?? ''} ${f.properties.street}`.trim(), f.properties.city, f.properties.state].filter(Boolean).join(', '),
        kind: f.properties.osm_value ?? f.properties.type,
        lng: r(f.geometry.coordinates[0], 5),
        lat: r(f.geometry.coordinates[1], 5),
      })),
    };
  } catch {
    return { error: 'geocoder unavailable' };
  } finally {
    clearTimeout(t);
  }
}

// ------------------------------------------------------------------ reading published layer files
type Geom = { type: string; coordinates: unknown };
type Feature = { properties: Record<string, unknown>; geometry: Geom | null };
const files = new Map<string, Promise<Feature[]>>();
/** The site serves its own data files; the function reads them over HTTP from the same deployment. */
function loadLayer(origin: string, l: Layer & { data?: string }): Promise<Feature[]> {
  if (!l.data) return Promise.resolve([]);
  let p = files.get(l.id);
  if (!p) {
    p = fetch(new URL(l.data, origin)).then(async (r) => {
      if (!r.ok) throw new Error(`data ${r.status}`);
      return ((await r.json()) as { features: Feature[] }).features ?? [];
    });
    p.catch(() => files.delete(l.id));
    files.set(l.id, p);
  }
  return p;
}

function inRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolygon(x: number, y: number, g: Geom): boolean {
  const polys = g.type === 'Polygon' ? [g.coordinates as number[][][]] : g.type === 'MultiPolygon' ? (g.coordinates as number[][][][]) : [];
  return polys.some((rings) => inRing(x, y, rings[0]) && !rings.slice(1).some((h) => inRing(x, y, h)));
}
function flatCoords(g: Geom): number[][] {
  const out: number[][] = [];
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === 'number') out.push(c as number[]);
    else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(g.coordinates);
  return out;
}
/** Bounding-box center: good enough to fly to or pin a tract. */
function centerOf(g: Geom): [number, number] {
  const c = flatCoords(g);
  const xs = c.map((p) => p[0]);
  const ys = c.map((p) => p[1]);
  return [r((Math.min(...xs) + Math.max(...xs)) / 2, 5), r((Math.min(...ys) + Math.max(...ys)) / 2, 5)];
}
const meters = (a: number[], b: number[]) => {
  const k = Math.PI / 180;
  const x = (b[0] - a[0]) * k * Math.cos(((a[1] + b[1]) / 2) * k);
  const y = (b[1] - a[1]) * k;
  return Math.sqrt(x * x + y * y) * 6371000;
};

/** Runs one tool call. Server tools return data; map tools are validated and queued for the browser. */
export async function runTool(name: string, args: Record<string, unknown>, actions: Action[], origin = 'http://localhost:5180'): Promise<unknown> {
  switch (name) {
    case 'features_at':
    case 'rank_features': {
      const l = C.layers.find((x) => x.id === args.layer) as (Layer & { data?: string }) | undefined;
      if (!l) return { error: `no layer "${args.layer}"`, ids: C.layers.map((x) => x.id) };
      let feats: Feature[];
      try {
        feats = await loadLayer(origin, l);
      } catch (e) {
        return { error: `could not read the layer file (${(e as Error).message})` };
      }
      const src = { layer: l.id, source: l.source.name, updated: l.updated };
      if (name === 'features_at') {
        const x = okLng(args.lng);
        const y = okLat(args.lat);
        if (x == null || y == null) return { error: 'lng/lat out of range' };
        const hit = feats.filter((f) => f.geometry && inPolygon(x, y, f.geometry)).slice(0, 3);
        if (hit.length) return { ...src, matches: hit.map((f) => f.properties) };
        const near = feats
          .filter((f) => f.geometry && !/Polygon/.test(f.geometry.type))
          .map((f) => ({ f, d: Math.min(...flatCoords(f.geometry!).map((p) => meters([x, y], p))) }))
          .filter((v) => v.d <= 400)
          .sort((a, b) => a.d - b.d)
          .slice(0, 5);
        return near.length ? { ...src, matches: near.map((v) => ({ ...v.f.properties, distance_m: Math.round(v.d) })) } : { ...src, matches: [], note: 'nothing from this layer at that spot' };
      }
      const field = String(args.field ?? '');
      if (!l.fields?.some((f) => f.name === field && f.type === 'number')) return { error: `"${field}" is not a numeric field`, numeric_fields: (l.fields ?? []).filter((f) => f.type === 'number').map((f) => f.name) };
      const bb = Array.isArray(args.bbox) && args.bbox.length === 4 && args.bbox.every((v) => typeof v === 'number') ? (args.bbox as number[]) : null;
      const rows = feats
        .filter((f) => f.geometry && typeof f.properties?.[field] === 'number')
        .map((f) => ({ props: f.properties, center: centerOf(f.geometry!) }))
        .filter((v) => !bb || (v.center[0] >= bb[0] && v.center[0] <= bb[2] && v.center[1] >= bb[1] && v.center[1] <= bb[3]));
      const sign = args.order === 'lowest' ? 1 : -1;
      rows.sort((a, b) => sign * ((a.props[field] as number) - (b.props[field] as number)));
      const n = Math.max(1, Math.min(10, Math.round(num(args.limit, 1, 10, 5)!)));
      return { ...src, field, order: args.order === 'lowest' ? 'lowest' : 'highest', of: rows.length, results: rows.slice(0, n).map((v) => ({ ...v.props, center_lng: v.center[0], center_lat: v.center[1] })) };
    }
    case 'search':
      return { matches: search(String(args.query ?? '')) };
    case 'get_layer': {
      const l = C.layers.find((x) => x.id === args.id);
      if (!l) return { error: `no layer "${args.id}"`, ids: C.layers.map((x) => x.id) };
      return l;
    }
    case 'geocode':
      return geocode(String(args.query ?? ''));
    case 'fly_to': {
      const lng = okLng(args.lng);
      const lat = okLat(args.lat);
      if (lng == null || lat == null) return { error: 'lng/lat out of range' };
      const view = { lng, lat, zoom: num(args.zoom, 1, 18, 13)!, pitch: num(args.pitch, 0, 75, 55)!, bearing: num(args.bearing, -180, 360, -15)!, name: typeof args.name === 'string' ? args.name.slice(0, 80) : undefined };
      actions.push({ type: 'fly_to', view });
      return { ok: true };
    }
    case 'show_layers': {
      const want = Array.isArray(args.layers) ? args.layers.map(String) : [];
      const known = want.filter((id) => C.layers.some((l) => l.id === id));
      actions.push({ type: 'show_layers', layers: known });
      return known.length === want.length ? { ok: true } : { ok: true, ignored: want.filter((id) => !known.includes(id)), note: 'unknown ids were ignored' };
    }
    case 'drop_pins': {
      const pins = (Array.isArray(args.pins) ? args.pins : [])
        .slice(0, 8)
        .map((p) => p as Record<string, unknown>)
        .filter((p) => okLng(p.lng) != null && okLat(p.lat) != null)
        .map((p) => ({ lng: p.lng as number, lat: p.lat as number, zoom: 15, pitch: 0, bearing: 0, label: String(p.label ?? '').slice(0, 60) }));
      actions.push({ type: 'drop_pins', pins });
      return { ok: true, dropped: pins.length };
    }
    default:
      return { error: `unknown tool ${name}` };
  }
}

// ------------------------------------------------------------------ number check
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const norm = (s: string) => s.replace(/,/g, '').replace(/^0+(?=\d)/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
/** Numbers in `text` that appear in none of `sources` (rounded forms of a source figure are allowed; 0–12 pass as counts). */
export function untraced(text: string, sources: string[]): string[] {
  const allowed = new Set<string>();
  for (let i = 0; i <= 12; i++) allowed.add(String(i));
  for (const src of sources)
    for (const raw of src.match(NUMBER) ?? []) {
      const n = norm(raw);
      allowed.add(n);
      const v = Number(n);
      if (Number.isFinite(v)) {
        allowed.add(String(Math.round(v)));
        allowed.add(norm(v.toFixed(1)));
        allowed.add(norm(v.toFixed(2)));
        // A share written as a percent: 0.983 → 98.3 / 98.
        if (v > 0 && v <= 1) {
          allowed.add(norm((v * 100).toFixed(1)));
          allowed.add(String(Math.round(v * 100)));
        }
      }
    }
  return [...new Set((text.match(NUMBER) ?? []).map(norm).filter((n) => !allowed.has(n)))];
}

export const tidy = (s: string) =>
  s
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim();

// ------------------------------------------------------------------ request handling
interface InMsg {
  role: 'user' | 'assistant';
  text: string;
}
export function clean(body: unknown): { messages: InMsg[]; context: Record<string, unknown> } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages)) return null;
  const messages = b.messages
    .slice(-LIMITS.messages)
    .map((m) => m as Partial<InMsg>)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .map((m) => ({ role: m.role!, text: m.text!.trim().slice(0, LIMITS.text) }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return null;
  const ctx = (b.context && typeof b.context === 'object' ? b.context : {}) as Record<string, unknown>;
  return { messages, context: ctx };
}

function contextLine(ctx: Record<string, unknown>): string {
  const parts: string[] = [];
  const c = ctx.center;
  if (Array.isArray(c) && okLng(c[0]) != null && okLat(c[1]) != null) parts.push(`Map center: ${c[1]}, ${c[0]} at zoom ${num(ctx.zoom, 0, 22) ?? '?'}.`);
  const on = Array.isArray(ctx.layers) ? ctx.layers.map(String).filter((id) => C.layers.some((l) => l.id === id)) : [];
  parts.push(on.length ? `Layers on: ${on.join(', ')}.` : 'No data layers are on.');
  return `[Where the reader is right now: ${parts.join(' ')}]`;
}

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < LIMITS.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > LIMITS.perWindow;
}

interface ChatMsg {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'post_only' });
  const key = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const input = clean(body);
  if (!input) return res.status(400).json({ ok: false, reason: 'bad_request' });
  if (!key) return res.status(200).json({ ok: false, reason: 'no_api_key' });
  const fwd = req.headers?.['x-forwarded-for'];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (limited(ip)) return res.status(429).json({ ok: false, reason: 'rate_limited' });
  const hostHeader = req.headers?.['x-forwarded-host'] ?? req.headers?.host;
  const host = (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader) ?? 'localhost:5180';
  const proto = /^(localhost|127\.)/.test(host) ? 'http' : 'https';
  const origin = `${proto}://${host}`;

  // The system text (with the catalog) comes first and never changes between questions, so DeepSeek bills it as cached input.
  const msgs: ChatMsg[] = [{ role: 'system', content: SYSTEM }];
  input.messages.forEach((m, i) => msgs.push({ role: m.role, content: i === input.messages.length - 1 ? `${contextLine(input.context)}\n\n${m.text}` : m.text }));

  const actions: Action[] = [];
  const sources: string[] = [SYSTEM, ...input.messages.map((m) => m.text)];
  const usage = { input: 0, cached: 0, output: 0 };
  let text = '';
  try {
    for (let round = 0; round < LIMITS.rounds; round++) {
      const last = round === LIMITS.rounds - 1;
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, max_tokens: MAX_TOKENS, temperature: 0.3, thinking: { type: 'disabled' }, messages: msgs, ...(last ? {} : { tools: TOOLS }) }),
      });
      if (!r.ok) return res.status(200).json({ ok: false, reason: `deepseek_${r.status}` });
      const j = (await r.json()) as { choices?: { message?: ChatMsg; finish_reason?: string }[]; usage?: Record<string, number> };
      usage.input += j.usage?.prompt_tokens ?? 0;
      usage.cached += j.usage?.prompt_cache_hit_tokens ?? 0;
      usage.output += j.usage?.completion_tokens ?? 0;
      const msg = j.choices?.[0]?.message;
      if (!msg) break;
      if (!msg.tool_calls?.length) {
        text = msg.content ?? '';
        break;
      }
      msgs.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || '{}');
        } catch {
          /* empty args */
        }
        const out = JSON.stringify(await runTool(call.function.name, args, actions, origin)).slice(0, 12000);
        sources.push(out);
        msgs.push({ role: 'tool', tool_call_id: call.id, content: out });
      }
    }
  } catch (e) {
    console.error('[agent]', e);
    return res.status(200).json({ ok: false, reason: 'upstream_error' });
  }
  text = tidy(text);
  if (!text && actions.length) text = 'Done. Have a look at the map.';
  if (!text) return res.status(200).json({ ok: false, reason: 'empty_answer' });
  // Coordinates the model passed to its own tools count as sources too (it may name them back).
  const unverified = untraced(text, [...sources, JSON.stringify(actions)]);
  return res.status(200).json({ ok: true, text, actions, unverified, model, usage });
}
