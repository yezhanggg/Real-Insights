#!/usr/bin/env node
// Compiles content/ (site settings + data layers) into src/generated/content.json, the one file both the website
// and the agent read. It also writes public/feed.xml (RSS of datasets, newest first: email services can mail it to
// subscribers) and public/sitemap.xml.
//
//   node scripts/build-content.mjs              # published layers only (what `npm run build` ships)
//   node scripts/build-content.mjs --examples   # also content/examples/ (what `npm run dev` shows, badged "Example")
//
// Every check here fails loudly with the file name, so a broken post never reaches the site.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');
const PUBLIC = join(ROOT, 'public');
const withExamples = process.argv.includes('--examples') || process.env.INCLUDE_EXAMPLES === '1';

const problems = [];
const fail = (file, msg) => problems.push(`${file.replace(ROOT + '/', '')}: ${msg}`);

// ------------------------------------------------------------------ helpers
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
function checkView(v, file, where) {
  if (!v || typeof v !== 'object') return fail(file, `${where} needs lng and lat`), null;
  const { lng, lat } = v;
  if (!isNum(lng) || lng < -180 || lng > 180) return fail(file, `${where}.lng must be a longitude (−180 to 180)`), null;
  if (!isNum(lat) || lat < -85 || lat > 85) return fail(file, `${where}.lat must be a latitude (−85 to 85)`), null;
  const out = { lng, lat, zoom: isNum(v.zoom) ? v.zoom : 12, pitch: isNum(v.pitch) ? v.pitch : 50, bearing: isNum(v.bearing) ? v.bearing : -15 };
  if (typeof v.name === 'string') out.name = v.name;
  return out;
}

const toDate = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'string' ? v.slice(0, 10) : null);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function bboxOf(geojson) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      b[0] = Math.min(b[0], c[0]);
      b[1] = Math.min(b[1], c[1]);
      b[2] = Math.max(b[2], c[0]);
      b[3] = Math.max(b[3], c[1]);
    } else for (const x of c) walk(x);
  };
  for (const f of geojson.features ?? []) if (f.geometry) walk(f.geometry.coordinates ?? []);
  return Number.isFinite(b[0]) ? b.map((x) => Math.round(x * 1e5) / 1e5) : null;
}

/** Field list with type and, for numbers, min / max, so the Atlas legend and the agent can describe a layer. */
function fieldsOf(geojson) {
  const stats = new Map();
  for (const f of geojson.features ?? []) {
    for (const [k, v] of Object.entries(f.properties ?? {})) {
      const s = stats.get(k) ?? { name: k, type: null, min: Infinity, max: -Infinity, examples: new Set() };
      if (typeof v === 'number' && Number.isFinite(v)) {
        s.type ??= 'number';
        s.min = Math.min(s.min, v);
        s.max = Math.max(s.max, v);
      } else if (v != null && v !== '') {
        s.type = s.type === 'number' ? 'mixed' : 'text';
        if (s.examples.size < 4) s.examples.add(String(v).slice(0, 40));
      }
      stats.set(k, s);
    }
  }
  return [...stats.values()].map((s) =>
    s.type === 'number' ? { name: s.name, type: 'number', min: s.min, max: s.max } : { name: s.name, type: s.type ?? 'empty', examples: [...s.examples] },
  );
}

// ------------------------------------------------------------------ site
const siteFile = join(CONTENT, 'site.yaml');
const site = YAML.parse(readFileSync(siteFile, 'utf8'));
for (const k of ['title', 'tagline', 'author', 'url']) if (!site[k]) fail(siteFile, `needs "${k}"`);
site.url = String(site.url ?? '').replace(/\/$/, '');
site.home = checkView(site.home, siteFile, 'home');
site.gate = ['off', 'data', 'map'].includes(site.gate) ? site.gate : 'map';

// ------------------------------------------------------------------ layers
function readLayers(dir, example) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    const file = join(dir, name);
    let d;
    try {
      d = YAML.parse(readFileSync(file, 'utf8')) ?? {};
    } catch (e) {
      fail(file, `not valid YAML: ${e.message}`);
      continue;
    }
    const id = d.id ?? basename(name).replace(/\.ya?ml$/, '');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) fail(file, 'id must be lowercase letters, numbers and dashes');
    for (const k of ['title', 'source']) if (!d[k]) fail(file, `needs "${k}"`);
    if (!d.data && !d.tiles) fail(file, 'needs "data" (a GeoJSON file under public/) or "tiles" (an XYZ raster URL)');
    const layer = {
      id,
      title: d.title,
      dek: d.dek ?? '',
      about: d.about ?? '',
      source: typeof d.source === 'string' ? { name: d.source } : d.source,
      license: d.license ?? null,
      updated: toDate(d.updated),
      tags: d.tags ?? [],
      place: d.place ? checkView(d.place, file, 'place') : null,
      style: d.style ?? {},
      legend: d.legend ?? null,
      popup: d.popup ?? null,
      // Optional cover photo for the "Latest updates" list (a URL, or a file under public/).
      image: typeof d.image === 'string' ? d.image : null,
      example: example || undefined,
    };
    if (d.data) {
      const rel = String(d.data).replace(/^\//, '');
      const path = join(PUBLIC, rel);
      layer.data = '/' + rel;
      if (!existsSync(path)) fail(file, `data file not found: public/${rel}`);
      else {
        try {
          const gj = JSON.parse(readFileSync(path, 'utf8'));
          layer.count = gj.features?.length ?? 0;
          layer.bbox = bboxOf(gj);
          layer.fields = fieldsOf(gj);
          layer.geometry = gj.features?.[0]?.geometry?.type?.replace('Multi', '') ?? null;
          layer.bytes = readFileSync(path).length;
        } catch (e) {
          fail(file, `public/${rel} is not valid GeoJSON: ${e.message}`);
        }
      }
    } else {
      layer.tiles = d.tiles;
      layer.geometry = 'Raster';
      layer.bbox = d.bbox ?? null;
    }
    out.push(layer);
  }
  return out;
}

const layers = [...readLayers(join(CONTENT, 'layers'), false), ...(withExamples ? readLayers(join(CONTENT, 'examples', 'layers'), true) : [])];
const seen = new Set();
for (const l of layers) {
  if (seen.has(l.id)) fail(join(CONTENT, 'layers'), `two layers share the id "${l.id}"`);
  seen.add(l.id);
}
// Newest first: the landing page and the feed list what changed most recently.
layers.sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? '') || a.title.localeCompare(b.title));

if (problems.length) {
  console.error(`\n✗ content has ${problems.length} problem${problems.length > 1 ? 's' : ''}:\n  - ${problems.join('\n  - ')}\n`);
  process.exit(1);
}

// ------------------------------------------------------------------ write
mkdirSync(join(ROOT, 'src', 'generated'), { recursive: true });
writeFileSync(join(ROOT, 'src', 'generated', 'content.json'), JSON.stringify({ site, layers, built: new Date().toISOString() }));

const published = layers.filter((l) => !l.example);
const rfc822 = (d) => new Date(`${d ?? new Date().toISOString().slice(0, 10)}T12:00:00Z`).toUTCString();
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(site.title)}</title>
<link>${esc(site.url)}</link>
<description>${esc(site.tagline)}</description>
<language>en-us</language>
<atom:link href="${esc(site.url)}/feed.xml" rel="self" type="application/rss+xml"/>
${published
  .map(
    (l) => `<item>
<title>${esc(l.title)}</title>
<link>${esc(site.url)}/map/${l.id}</link>
<guid isPermaLink="false">${esc(l.id)}@${esc(l.updated ?? '')}</guid>
<pubDate>${rfc822(l.updated)}</pubDate>
<description>${esc(`${l.dek} Source: ${l.source?.name ?? ''}.`)}</description>
</item>`,
  )
  .join('\n')}
</channel>
</rss>
`;
writeFileSync(join(PUBLIC, 'feed.xml'), feed);
const urls = ['', '/map', ...published.map((l) => `/map/${l.id}`)];
writeFileSync(
  join(PUBLIC, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${esc(site.url + u)}</loc></url>`).join('\n')}\n</urlset>\n`,
);

console.log(`✓ content: ${layers.length} layer${layers.length === 1 ? '' : 's'}${withExamples ? ' (examples included)' : ''}`);
