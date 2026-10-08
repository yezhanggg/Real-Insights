# Ask the map: the agent

A chat box on the map that knows every published dataset and can drive the map. It runs on **DeepSeek** (`deepseek-flash` by default) through one serverless function, `api/agent.ts`. The browser never sees the key.

## What it can do

The model works in a tool-calling loop, up to 5 rounds per question. There are two kinds of tools:

**Server tools**, which run in the function and return data to the model:

| Tool | What it returns |
|---|---|
| `search(query)` | The best-matching datasets (title, description, source, tags, field names), with snippets |
| `get_layer(id)` | A layer's description, source, license, date, extent, and every field with its type and range |
| `features_at(layer, lng, lat)` | The values of whatever is at a spot: the polygon containing it, or points and lines within 400 m |
| `rank_features(layer, field, order, limit, bbox?)` | The highest or lowest features by a numeric field, each with a center point |
| `geocode(query)` | Coordinates for a place name or address ([Photon](https://photon.komoot.io), OpenStreetMap) |

**Map tools**, which are validated on the server and carried out in the browser:

| Tool | Effect |
|---|---|
| `fly_to(lng, lat, zoom, pitch, bearing, name)` | Moves the camera |
| `show_layers(ids)` | Sets which datasets are on (unknown ids are dropped) |
| `drop_pins([{lng, lat, label}])` | Up to 8 labeled pins |

The reply comes back as `{ text, actions[], unverified[] }`. The page carries out the actions and shows each one as a small chip under the answer, such as "Moved the map to University City". Clicking a chip replays it.

The box itself is ported from VisionPitts-Chat (see [DESIGN.md](DESIGN.md#ask-the-map-the-chat-box)). Typed text that reads like a place goes to the free Photon map search first, and only questions reach the model, which saves tokens.

The function also tells the model where the reader is: the map center and zoom, and which datasets are on. So questions like "what am I looking at?" work.

## Guardrails

1. **Grounded.** The system prompt holds the full catalog: every dataset, one line each. Details come only from tools. The model is told to look values up rather than guess.
2. **Every number is checked.** `untraced()` collects every figure in the answer and looks for it in the catalog, the tool results and the conversation. It accepts thousands separators, rounding, and a 0–1 share written as a percent. Anything it can't trace comes back in `unverified`, and the page shows "Check these figures: …" under the answer. Numbers 0–12 pass as counts.
3. **Scope.** The agent covers real estate, housing, land, development, infrastructure, cities and this site's content. Anything else gets one friendly sentence. It gives no investment, legal, zoning or appraisal advice, and it describes places, not people.
4. **General knowledge is labeled.** It starts with "In general," and carries no figures.
5. **Validated actions.** Coordinates are range-checked, layer ids must exist, and pins are capped at 8.
6. **Limits.** It keeps the last 10 messages, caps each at 1,200 characters and each answer at 700 tokens, and allows 30 questions per visitor per 10 minutes (in memory, per server instance). Nothing is stored.

Tests: `api/agent.test.ts` (`npm test`).

## Cost

The system prompt (with the catalog) comes first and doesn't change between questions, so DeepSeek bills it at the cached-input rate. In testing, a typical question with 2–3 tool rounds used about 6–10k input tokens (most of them cached) and about 400–750 output tokens. Each response includes `usage`, so you can watch it in the network tab or the Vercel logs.

The catalog grows with the site, one line per dataset. At a few hundred datasets, switch the prompt to the newest 50 and let `search` find the rest.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `DEEPSEEK_API_KEY` | (none) | Required. Without it, the panel says the assistant isn't connected. |
| `DEEPSEEK_MODEL` | `deepseek-flash` | `deepseek-v4-pro` is slower, stronger and pricier. |

To change the personality or rules, edit `SYSTEM` in `api/agent.ts`. To add a tool, add its JSON schema to `TOOLS` and a `case` in `runTool()`. Server tools return data; map tools push an `Action` and return `{ ok: true }`. If it's a new map action, also handle it in `apply()` (and `describe()`, for the chip text) in `src/lib/chat.ts`.

## Local testing

```bash
curl -s -X POST localhost:5180/api/agent -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","text":"Which tracts have the highest rent? Pin 3."}],"context":{"path":"/","layers":[]}}' | jq
```
