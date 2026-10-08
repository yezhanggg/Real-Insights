# Design

Vision REAL uses the **VisionPitts design system**: white and clean, violet as the one accent. The map tool matches the VisionPitts Explore screen. The start page uses the Orbit 3D hero, recolored violet.

## Layout

| Screen | Layout |
|---|---|
| Start page | A full-height Orbit hero. The header has the brand, the **Explore map** and **Release updates** links, and one button, **Subscribe**. A short statement sits on the left, and the data globe on the right. No map. |
| Release updates | The same header, a title, then one row per dataset (a hover photo follows the cursor), then the footer. |
| Subscribe pop-up | A rounded card over a blurred page: an email form on the left with staggered blur-in entrances, and a city photo (Unsplash) with three glass cards on the right. |
| Map (wide) | Full-bleed map. Top-left: Home and the brand. Left: the floating **Data** panel (Datasets and Settings sections, VisionPitts switches); it folds into a tab. Top-right: **Ask the map**, with the **Details** panel under it, which also folds. Bottom-left: the legend. Top-center: a dark hint pill until a dataset is on. |
| Map (phone) | The Data panel on top (40% height at most), the chat box and Details as a sheet along the bottom, and map zoom buttons hidden. |

## The start page

- **The globe** is a line-drawn purple glass sphere rising from the bottom of the hero like a horizon; only its upper half shows (`glassMaterial` in `ui/orbit-delivery-hero.tsx`). It is mostly clear, with a 10° graticule (stronger every 30°), a soft violet rim and a thin cyan scan line. The far side of the graticule shows faintly through. On it:
  - **Coastlines:** 186 thin violet lines from Natural Earth 1:110m, simplified (`world-lines.ts`), with the far side faint.
  - **Network:** 34 hubs picked on land (`world-dots.ts`) and joined by low arcs, with cyan pulses travelling along them (`DataNetwork`).
  - **Instrument rings:** two thin orbit rings, one violet with tick marks and one cyan (`OrbitRings`). Each swings slowly around the vertical like a gyroscope, and a point of light with a fading tail runs along it.
- **No figure.** The globe is the whole scene.
- **Interaction:** drag to turn (arrow keys and Space work too); the Pause button stops it. There's no on-screen drag hint. With reduced motion, the scan line, pulses and rings hold still.
- **The copy** is one statement under a short rule: "Real estate data on a live map. Every number has a source and an address." It comes in word by word (`ui/text-reveal.tsx`), the first sentence in deep violet and the second in a lighter one.
- **Caption type.** Every line of words on the start page is set like the two corner captions: small capitals, tracked 0.25em, with a line height near 1.9, in lavender. That covers the statement (14–17 px), the header links and the Subscribe label (11 px), the corner captions, Pause and the loading note (10 px). The brand name is the one exception. The plain pages' header (`SiteHeader.tsx`) uses the same links and button.
- **The Subscribe button** is a violet pill with a soft light that follows the cursor across it (`ui/hover-glow-button.tsx`). On phones the two links drop to their own row under the brand so the button stays on screen.

## Tokens (`src/styles.css`, same values as VisionPitts)

| Token | Value | Use |
|---|---|---|
| Primary | `rgb(124 58 237)` violet-600 (hover violet-700) | Buttons, the active state, pins, the selected shape, links |
| Page | `#f6f5f3` | Behind everything |
| Column | `#fbfaf8` | The reading column and its sticky bar |
| Card | `#ffffff` with `ring-1 ring-stone-200`, `rounded-2xl` | Updates rows, Details panel, dataset switches |
| Floating control | `bg-white/95 shadow-lg ring-1 ring-black/5 backdrop-blur`, `rounded-xl` or `rounded-[24px]` | Brand pill, chat box, legend |
| Text | slate-900 (headings), slate-600 (body), slate-500 (captions) | |
| Accent surfaces | violet-50 + ring violet-200 | Action chips, selected tags, place links |
| Notice | amber-50 + ring amber-200 | Example/draft badges, untraced figures in an answer |

**Type:** DM Sans for text (with tabular numbers on), and Space Grotesk bold for headings and the brand. The scale runs caption 12 · small 13 · body 14 · lead 16 · title 20 · display 26. Nothing is smaller than 12 px except map credits, the chat timestamps and the start page's caption type.

**The primary tile.** One big violet tile per page at most, like "Open VisionPitts" on its landing page. Here it is the **Open the map** button on the start page.

## The map

- The basemap is OpenFreeMap **positron**, untouched, with VisionPitts' sky and fog (`#dfe9f3` / `#f4efe8` / `#f6f4f1`), Mapterhorn terrain, a light hillshade, and muted 3D buildings (`#e7e5e4`) from zoom 14.
- **Pins:** a violet dot on a short stem, with a white pill label (VisionPitts' search pin). Pins dropped by the assistant or the place search are violet rings with a white label; the selected shape gets a violet outline.
- **Data ramps** are VisionPitts' palettes: warm `#fdf4e3 → #8f2d2a` for "more", and green `#f3f8ec → #1d5f48` for green space, water or "good" (`WARM` / `SEA` in `pipeline/realinsights/publish.py`).
- Popups are white, `rounded-2xl`, with a violet kicker, a Space Grotesk title and tabular figures.

## Ask the map (the chat box)

It's ported from **VisionPitts-Chat** (`src/components/ChatBox.tsx`, `src/components/ui/ai-chat-input.tsx`):

- One box to **search a place or ask a question**. Typed text is sorted in the browser: places go to the free map search (Photon) and show as rows with an `Enter ↵` hint; questions get an **Ask the assistant · AI** row.
- The input is a pill that springs open into a growing text area, with a microphone for dictation where the browser supports it. Its single button morphs between mic, send, spinner and stop.
- While it works, a **thinking orb** (`thinking-orbs`) shows changing status words with a shimmer: *Reading the published data → Finding the places → Writing the answer*.
- Bubbles have tails and timestamps: questions are violet on the right, answers white on the left. Answers write themselves in a few words at a time, and the caption reads *AI-written · checked against the published data*. Untraced figures get an amber note.
- What the agent did to the map appears as violet chips under the answer; click a chip to replay it. Suggested questions change with the page. A header bar holds the name, Clear, and a fold chevron.
- The conversation is kept across reloads (`localStorage`, last 30 messages), like VisionPitts.

## Motion

Spring transitions throughout (Motion; stiffness about 340–420). The section highlight slides between tabs. Map flights take 2.6 s on a curve, and the front page orbits slowly until touched. Everything respects `prefers-reduced-motion`.

## Voice

Plain, first person, short sentences. Start with what you saw, then where it is, then why it matters. Say where a number comes from in the same sentence. Label judgments as judgments.
