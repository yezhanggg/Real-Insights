# Architecture

A static React site (three pages and a pop-up) plus two serverless functions. There's no database for content: datasets are files in git, compiled at build time.

```
content/site.yaml, content/layers/*.yaml ─┐
public/data/*.geojson ────────────────────┴─► scripts/build-content.mjs ─► src/generated/content.json ─┬─► the website
                                                    └─► public/feed.xml (datasets, newest first), sitemap.xml └─► api/agent.ts
browser ─► /api/agent ─► DeepSeek (tool loop) ─► { text, actions } ─► the map moves
browser ─► /api/subscribe ─► Buttondown or Supabase
```

## Screens and routing

`src/lib/router.ts` is a small router over the History API. `src/App.tsx` picks the screen:

| Path | Screen | Notes |
|---|---|---|
| `/` | `Landing.tsx` | Orbit hero (lazy-loaded chunk, three.js) → footer. No map. |
| `/updates` | `Updates.tsx` | Release updates: one row per dataset, newest first |
| `/subscribe?next=/map/…` | the start page with the pop-up open | `next` must be a path on this site. The pop-up (`ui/subscribe-dialog.tsx`) opens over any page via `openSubscribe(next)` in `src/lib/subscribe.ts`. |
| `/map`, `/map/<id>` | `MapTool.tsx` | `/atlas` (the old address) still works. The address follows the last dataset turned on, so it can be shared. |

With `gate: map`, a not-yet-subscribed reader who opens any `/map…` link sees the start page with the pop-up open, and goes on into the map once subscribed.

## The content build

`scripts/build-content.mjs` runs before `dev`, `build` and `test`. For each layer YAML it opens the GeoJSON and records the feature count, bounding box, geometry type, size, and every field with its type and min/max. The Details panel, the legend and the agent all use this. It sorts layers newest first and writes `src/generated/content.json` (git-ignored), `public/feed.xml` and `public/sitemap.xml`. With `--examples` (used by `npm run dev`) it also reads `content/examples/`. Production builds don't, and a Vite plugin deletes `dist/data/examples/`.

## The map tool

`MapTool.tsx` follows the VisionPitts Explore layout. `MapStage.tsx` mounts one MapLibre map and opens with a globe-to-place flight. Everything is steered through a small Zustand store (`src/lib/store.ts`):

| Store field | Set by | Effect |
|---|---|---|
| `camera` | dataset toggles, Go to, the agent, place search | `flyTo` (a jump with reduced motion) |
| `layers` | the Data panel, the agent | adds the source and layers on first use, then toggles visibility |
| `look` | Settings section | buildings, terrain, hill shading |
| `focus`, `feature` | Info buttons, map clicks | the Details panel: the clicked shape's values (violet outline on the map) and the dataset's source, license and download |
| `agentPins` | the agent, place search | violet pins with white labels |
| `railOpen`, `panelOpen`, `hintClosed` | the panels | VisionPitts-style fold into tabs |

`src/lib/map.ts` holds the scene (positron basemap, terrain, sky, buildings) and `buildLayers()`, which turns a layer's YAML `style` into MapLibre layers.

## Integrated UI components

Pasted components live in `src/components/ui/` (the shadcn convention; `@/` maps to `src/`, and `components.json` describes the setup for the shadcn CLI). Each was adapted rather than used as-is:

| File | Origin | Changes |
|---|---|---|
| `orbit-delivery-hero.tsx` + `world-lines.ts`, `world-dots.ts` | 21st.dev "Orbit Delivery" | Kept the template's drag-to-turn motion, layout and responsive camera. The planet and courier models are gone. In their place is a line-drawn purple glass globe, sitting on the bottom edge so only its upper half shows. It is a transparent shader sphere (graticule, rim, scan line) with its back faces drawn faintly first. It carries 186 Natural Earth coastlines (`world-lines.ts`); a depth-only inner shell hides the far side from the bright front layers, while faint ghost layers show it through the glass. A seeded network of hubs on land (`world-dots.ts`) carries travelling pulses, and there are instrument rings. The palette is violet; the header has links plus the one Subscribe button; the headline, the drag caption, story dialogs and debug "prototype" mode are removed. Nothing to download: no GLB or Draco. |
| `text-reveal.tsx` + `text-reveal-utils/*` | 21st.dev "text-reveal" | Used for the start page's statement and its two corner captions. The component is as published. Its two helper files, missing from the template, were written here: the timing tokens and the CSS module with the keyframes. The entrance is CSS only, and the resting state is the visible one. |
| `hover-glow-button.tsx` | 21st.dev "hover-glow-button" | The Subscribe button in both headers. Violet defaults, the usual button props, and size and shape left to `className`. No glow and no inline color while disabled, so "Subscribed ✓" keeps its quiet look. The template's theme CSS (radius overrides, a ripple color, `tw-animate-css`) isn't used by the component and was left out. |
| `project-showcase.tsx` | 21st.dev "project-showcase" | Rows come in as props (one per dataset). The follow animation only runs while a preview shows. The preview is hidden on phones. |
| `subscribe-dialog.tsx` | 21st.dev "sign-in" | Turned into a pop-up. Email only (no password or Google button, since there are no accounts). The template's testimonials became three factual cards. Escape or a click outside closes it. The entrance animations are in `styles.css`. |
| `footer-1.tsx` + `footer-1-utils/*` | 21st.dev "footer-1" | Plain links instead of `next/link`. The two helper files, missing from the template, were written here: the newsletter box posts to `/api/subscribe`. Only real links. |
| `button.tsx`, `input.tsx` | shadcn | As published |
| `ai-chat-input.tsx`, `thinking-orbs.tsx` | VisionPitts | The Ask the map input and thinking orb |

## API functions (Vercel, Node)

- `api/agent.ts`: see [AGENT.md](AGENT.md). It imports `src/generated/content.json` at build time and reads layer GeoJSON over HTTP from its own deployment.
- `api/subscribe.ts`: tries Buttondown, then Supabase (`supabase/migrations/0001_subscribers.sql`). In development it accepts the address without storing it. `src/lib/subscribe.ts` is the one client-side path to it.

## File map

```
api/                       serverless functions (+ tests)
content/site.yaml          title, tagline, map home view, gate, links
content/layers/            published dataset descriptions (YAML)
content/examples/          dev-only example dataset
public/data/               dataset GeoJSON (served at /data/…)
pipeline/                  Python: publish_layer, Census helpers, spatial toolkit
scripts/build-content.mjs  content → src/generated/content.json + feed + sitemap
src/App.tsx                screen switch + gate redirect
src/components/            Landing, Updates, SiteHeader, MapTool, MapStage, ChatBox, Legend, primitives, ui/
src/lib/                   content, map, store, router, chat, subscribe, format, utils, types
src/styles.css             theme tokens (Tailwind 4) + map pins + page animations
```

## Performance notes

- The map chunk is about 450 KB gzipped (mostly MapLibre). The start page's 3D hero is a separate chunk (three.js); it loads no model files. The hero drops to a lower resolution on low-power devices and stops rendering when off-screen or when the tab is hidden.
- Layer GeoJSON loads only when a dataset is first turned on. Keep files under about 5 MB; beyond that, use vector tiles (PMTiles).
