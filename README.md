# Vision REAL

*Real estate data on a live map. Every number has a source and an address.*

**Vision REAL is a free, live map of real estate data by Ye Zhang.** New datasets go up as they're ready. Subscribers get one email per update, and everyone can explore, click and download everything on the map. The site has three screens:

| Screen | What it is | Built from |
|---|---|---|
| **Start page** (`/`) | No map. A line-drawn purple glass globe rising from the bottom like a horizon: coastlines (Natural Earth), a fine grid with the far side showing through, a network of hubs with pulses travelling between them, and instrument rings. Drag to turn it. The header has two links, **Explore map** and **Release updates**, and one button, **Subscribe**. | `Landing.tsx` + `ui/orbit-delivery-hero.tsx`, `ui/footer-1.tsx` |
| **Release updates** (`/updates`) | Every dataset, newest first; hover a row for a preview photo that follows the cursor, click to open it on the map. | `Updates.tsx` + `ui/project-showcase.tsx` |
| **Subscribe pop-up** | Opens over any page (also at `/subscribe`). Email only (no accounts or passwords). The form is on the left, and a city photo with three facts about the site is on the right. When the map asked for it, the reader goes straight on into the map. | `ui/subscribe-dialog.tsx` |
| **Map** (`/map`, `/map/<dataset>`) | The tool, laid out like the VisionPitts Explore screen: the live 3D map with Home, the **Data** panel, **Ask the map**, **Details** (click any shape) and the legend. | `MapTool.tsx`, `MapStage.tsx`, `ChatBox.tsx`, `api/agent.ts` |

No analysis is published yet. A working **example dataset** (Philadelphia median rent by census tract) appears only when you run the site locally, labeled "Example", so you can see every feature. Production builds leave it out.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5180 (includes the example)
npm test             # agent + subscribe unit tests
npm run build        # production build into dist/ (no examples)
```

The assistant needs `DEEPSEEK_API_KEY` in `.env`, which is already set up locally and git-ignored. Everything else runs without keys. See [.env.example](.env.example).

## Publishing an update

Every update is a dataset. Shape the data in Python, then publish it in one call:

```bash
cd pipeline && uv sync && cd ..
uv run --project pipeline python pipeline/publish_layer.py my_data.gpkg \
  --id phl-permits-2025 --title "Building permits, 2025" \
  --source "City of Philadelphia, L&I" --source-url https://opendataphilly.org \
  --color-field value --popup-title address --tags permits,philadelphia
```

That writes `public/data/phl-permits-2025.geojson` and `content/layers/phl-permits-2025.yaml` (title, one-line description, notes, source, colors, popup fields, and an optional cover `image` for the updates list). Deploy, and the dataset appears in the map's Data panel, at the top of **Release updates**, and in `/feed.xml`. Then email subscribers, by hand or automatically from the RSS feed.

Full guide: **[docs/PUBLISHING.md](docs/PUBLISHING.md)**.

## Free, with a subscribe ask

`gate:` in `content/site.yaml` sets what needs a (free) email:

| `gate:` | Behavior |
|---|---|
| `map` *(default)* | "Explore map" (and any link into the map) opens the Subscribe pop-up first, then goes straight on |
| `data` | The map opens for everyone; turning on a dataset or downloading opens the pop-up |
| `off` | Nothing asks |

It's a friendly ask, not security: the browser remembers the sign-up, and the data files are public by design.

## Documentation

| Doc | For |
|---|---|
| [docs/PUBLISHING.md](docs/PUBLISHING.md) | Adding datasets, the layer YAML and styles, site settings, the checklist |
| [docs/DATA_TOOLKIT.md](docs/DATA_TOOLKIT.md) | The spatial methods (from MUSA 6950) mapped to real estate questions, with code and free data sources |
| [docs/AGENT.md](docs/AGENT.md) | How Ask the map works: tools, guardrails, the number check, cost |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit, file map, the integrated UI components |
| [docs/DESIGN.md](docs/DESIGN.md) | The VisionPitts design system, the start page, the chat box, the map style |
| [docs/LAUNCH.md](docs/LAUNCH.md) | Going live on Vercel: environment variables, domain, subscriptions |
| [pipeline/README.md](pipeline/README.md) | The Python side |

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 (shadcn conventions: `@/` alias, `components/ui`, `cn`) · Motion · MapLibre GL 5 (OpenFreeMap positron, Mapterhorn/USGS 3DEP terrain, 3D buildings) · three.js + React Three Fiber (start page) · Zustand · Vercel (static site + two serverless functions) · DeepSeek (`deepseek-flash`) · Python 3.11+ with GeoPandas for the data.

The map tool, chat box and design system come from [VisionPitts](https://ye-zhang-vision-pitts.vercel.app). The start-page hero and its text reveal, the Subscribe button, the updates list, the Subscribe pop-up and the footer are 21st.dev components adapted to the site; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#integrated-ui-components).

## Principles

1. **Every number has a source and a location.** Each dataset shows both, and the assistant's answers are checked number by number against the published data.
2. **Facts and opinions are labeled differently.**
3. **No individuals.** Data are shown for areas, never for people.
4. **Keys stay on the server.** Nothing secret is in the browser bundle or in git.
5. **Decision support, not advice.**

## License

Code: MIT ([LICENSE](LICENSE)). Each dataset keeps its publisher's license, listed with the layer. Coastlines: Natural Earth (public domain). The start page loads no model files.
