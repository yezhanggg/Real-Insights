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
| `/` | `Landing.tsx` | Orbit hero (lazy-loaded chunk, three.js), one screen tall. No map, no footer. |
| `/updates` | `Updates.tsx` | Insights: one row per dataset, newest first |
| `/subscribe?next=/map/…` | the start page with the pop-up open | `next` must be a path on this site. The pop-up (`ui/subscribe-dialog.tsx`) opens over any page via `openSubscribe(next)` in `src/lib/subscribe.ts`. |
| `/map`, `/map/<id>` | `MapTool.tsx` | `/atlas` (the old address) still works. The address follows the last dataset turned on, so it can be shared. |

**One header.** `App.tsx` mounts `SiteHeader.tsx` once, over every page except the map tool, so the name, the two links and the Subscribe button sit in exactly the same place everywhere and don't restart between pages. Each page leaves `--header-h` of room at the top and uses `--gutter` as its side margin (both in `src/styles.css`: 104 px and 6.5% on a desktop; 90 px and 5% under 1150 px wide; 112 px and 25 px under 540 px, where the two links take their own row; 64 px on a phone held sideways). `--gutter` also respects a phone's notch. Only its name, links and button take the pointer, so the globe's crosshair and drag carry on underneath.

With `gate: map`, a not-yet-subscribed reader who opens any `/map…` link sees the start page with the pop-up open, and goes on into the map once subscribed.

**Before launch.** While `launched: false` in `content/site.yaml`, `/map…` and `/updates` render `ComingSoon.tsx` (a thinking orb, "Superloading…", "Coming soon") instead, nothing is asked at the gate, and the Subscribe pop-up is a wait-list. `App.tsx` makes that choice; set `launched: true` to open the pages.

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
| `orbit-delivery-hero.tsx` + `world-lines.ts`, `world-dots.ts` | 21st.dev "Orbit Delivery" | Kept the template's drag-to-turn motion (made about twice as fast), layout and responsive camera. The Pause button and the Space shortcut are gone; the globe turns from the first frame. The planet and courier models are gone. In their place is a line-drawn purple glass globe, with its center just below the bottom edge so a little less than its upper half shows. It is a transparent shader sphere (graticule, rim, scan line) with its back faces drawn faintly first. It carries 186 Natural Earth coastlines (`world-lines.ts`); a depth-only inner shell hides the far side from the bright front layers, while faint ghost layers show it through the glass. A seeded network of hubs on land (`world-dots.ts`) carries travelling pulses, and there are instrument rings. The palette is violet; the template's header is gone (the site header, `SiteHeader.tsx`, is laid over the hero like over every page, and the hero only leaves room for it); the headline, the drag caption, the two corner captions, story dialogs and debug "prototype" mode are removed. Nothing to download: no GLB or Draco. |
| `text-scramble.tsx` | 21st.dev "text-scramble" | The start page's slogan and the line under it. Each line settles out of random capitals once when the page opens, and again whenever the pointer comes onto the slogan (`ScrambleLines` in the hero). Motion instead of framer-motion; the motion element is made once, not on every render; the timer is cleared on unmount; with reduced motion the text simply stands. Screen readers get the plain sentence. It replaces the earlier word-by-word reveal. |
| `cursor-crosshair.tsx` | 21st.dev "variable-font-and-cursor" | Only the demo's cursor-following part: two hairlines and a small square that track the mouse across the start page's hero. The variable-font text, the x/y readout, the two mouse hooks and `framer-motion` are not used. The position is written straight to CSS variables, so nothing re-renders. Mouse only. The square replaces the pointer over the globe and steps aside over links and buttons. |
| `3d-button.tsx` | 21st.dev "3d-button" | The Subscribe button in the header. Its moves are kept (letters rolling on hover, a light round the edge, the swinging arrow, the splash on a press, the outline drawing itself and the label change after a click). Its look is not: no purple slab, stacked shadow or tilt; a clear, upright pill. The template shipped keyframes only, so the rest of the styles were written here, under `.sub3d` in `src/styles.css` (the template's class names, `.button`, `.content`, `.outline`, would collide with Tailwind). The splash is restarted by a key, so a quick tap plays it through. |
| `project-showcase.tsx` | 21st.dev "project-showcase" | Rows come in as props (one per dataset). The follow animation only runs while a preview shows. The preview is hidden on phones. |
| `subscribe-dialog.tsx` + `health-stat-card.tsx` | 21st.dev "health-stat-card" | The Subscribe pop-up is the stat card with the email form under its legend. Email only. Motion instead of framer-motion; `children`, `titleId`, `barMaxWidth` and `showValues` were added. The three stats are words and the bars carry no figures (`showValues={false}`): they name the parts of the site, so nothing on the card is an invented number. The template's floating tooltip (and its Radix dependency) is gone: the bar pointed at, focused or tapped is described in a caption under the bars, inside the card, and the others dim. The grey panel behind the bars is gone too. On a short wide screen the card lays out in two columns (facts and bars beside the form). The header rocket lifts off and returns on a loop (`.rocket-launch` in `src/styles.css`). Escape or a click outside closes it. |
| `morph-button.tsx` | 21st.dev "Morph Button" (Spectrum UI) | The join button in the Subscribe pop-up. It follows the sign-up request: full width when idle, then it shrinks to a spinner and "Adding you", then a green pill with a check that draws itself ("You're on the list"), or a red one with an X and a shake when the address was not added, after which it returns to idle. Motion instead of framer-motion; `type` so it submits the form; the site's violet; `block` (full width when idle); `burst`, a ring of small dots thrown out on success. The pop-up holds the spinner at least 0.7 s and the check 1.7 s so each state can be read. |
| `text-loop.tsx` | 21st.dev "text-loop" | The site's name in the header: "Vision" plain, then "REAL" in a violet gradient. "REAL" wipes in once over a soft violet block with a blinking cursor; when that has played, the block and the cursor fade away (`settle`) and the name stands plain. Size, weight and tracking come from `className`. With one word there is nothing to rotate. |
| `ai-chat-input.tsx`, `thinking-orbs.tsx` | VisionPitts | The Ask the map input and thinking orb. The same orb, in its "breathing" state, is the mark of the Coming soon page, where `LargeOrb` (in `thinking-orbs.tsx`) paints the library's frames at 240 px, since the package's own component stops at 64 px and stretching it blurs. A pasted 21st.dev "thinking-orb" wrapper came without its helper files; it wraps this same library, so the package is used directly. |

## API functions (Vercel, Node)

- `api/agent.ts`: see [AGENT.md](AGENT.md). It imports `src/generated/content.json` at build time and reads layer GeoJSON over HTTP from its own deployment.
- `api/subscribe.ts`: tries Buttondown, then Supabase (`supabase/migrations/0001_subscribers.sql`). In development it accepts the address without storing it. `src/lib/subscribe.ts` is the one client-side path to it.

## File map

```
api/                       serverless functions (+ tests)
content/site.yaml          title, tagline, map home view, gate, launched, links
content/layers/            published dataset descriptions (YAML)
content/examples/          dev-only example dataset
public/data/               dataset GeoJSON (served at /data/…)
pipeline/                  Python: publish_layer, Census helpers, spatial toolkit
scripts/build-content.mjs  content → src/generated/content.json + feed + sitemap
src/App.tsx                screen switch + gate redirect
src/components/            Landing, Updates, ComingSoon, SiteHeader, MapTool, MapStage, ChatBox, Legend, primitives, ui/
src/lib/                   content, map, store, router, chat, subscribe, format, utils, types
src/styles.css             theme tokens (Tailwind 4) + map pins + page animations
```

## Performance notes

- The map chunk is about 450 KB gzipped (mostly MapLibre). The start page's 3D hero is a separate chunk (three.js); it loads no model files. The hero drops to a lower resolution on low-power devices and stops rendering when off-screen or when the tab is hidden.
- Layer GeoJSON loads only when a dataset is first turned on. Keep files under about 5 MB; beyond that, use vector tiles (PMTiles).
