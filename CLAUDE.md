# Vision REAL: notes for coding agents

Read README.md and docs/ARCHITECTURE.md first.

- Content is files: `content/site.yaml`, `content/layers/*.yaml` + `public/data/*.geojson` (every update is a dataset; there are no posts). `scripts/build-content.mjs` validates and compiles them; never hand-edit `src/generated/`.
- Before launch, `launched: false` in `content/site.yaml` makes `/map` and `/updates` (Insights) show `ComingSoon.tsx` and turns Subscribe into a wait-list.
- Screens: `/` start page (no map), `/subscribe`, `/map` (MapStage, steered only through the Zustand store: `camera`, `layers`, `look`, `focus`, `feature`, `agentPins`).
- Pasted UI components live in `src/components/ui/` (shadcn convention, `@/` → `src/`); see docs/ARCHITECTURE.md for how each was adapted.
- Keys are server-side only (`api/*.ts`, read from `.env` locally / Vercel env in production). Never add a `VITE_` secret. Never commit `.env`.
- The agent must never invent numbers: keep `untraced()` and its tests passing when changing `api/agent.ts`.
- Example content lives in `content/examples/` and `public/data/examples/` and is dev-only. Don't publish analysis the author hasn't written.
- Look: the VisionPitts design system (docs/DESIGN.md). White and clean, violet-600 primary, DM Sans + Space Grotesk, Tailwind 4 tokens in src/styles.css. The chat box is ported from VisionPitts-Chat; keep the two in step.
- Before finishing: `npm run typecheck && npm test && npm run build`.
