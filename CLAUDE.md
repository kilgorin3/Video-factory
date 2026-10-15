# Video Factory: notes for Claude

Spec-driven pipeline: `projects/<name>/video.yaml` -> narration, visuals, music -> `build/timeline.json` -> Remotion render -> mastered mp4 + thumbnail + captions + YouTube metadata.

## Commands
- `npm run vf -- build <project> --mock --preset draft`: full pipeline with no API spend. Use this to verify any change.
- `npm run stills -- <project> <frame> [frame...]`: render single frames to `build/stills/` for quick visual checks.
- `npm run typecheck`, `npm test`.
- Set `REMOTION_BROWSER_EXECUTABLE` if Remotion can't download its headless shell.

## Layout
- `src/spec/`: zod schema (source of truth for video.yaml), themes, loader/cross-checks.
- `src/text/`: narration parsing ([[cues]], pronunciations, alignment), captions/SRT.
- `src/pipeline/`: assets, cache, timeline (pure), fonts, render, post (mastering, metadata), lint, estimate, build orchestrator.
- `src/providers/`: ElevenLabs, OpenAI, fal.ai, Pexels, placeholder, local TTS.
- `src/remotion/`: compositions, scene templates (`scenes/`), shared components (`components/kit.tsx`).
- `src/planner/`: Claude storyboard planner and fact-checker. `src/mcp/server.ts`: MCP server. `src/publish/`: YouTube.

## Rules
- Paid API calls go through `withCache` so re-runs are free. Never call a provider outside it.
- The renderer must not touch the network: everything it needs goes in `build/public/` and the timeline.
- Templates design on a 1080px short edge via `useLayout().u()`; check 16:9 and 9:16 when changing layouts.
- When adding a scene template, follow the checklist at the end of docs/SPEC.md (schema, component, registry, cues, planner prompt).
- MCP server: stdout is JSON-RPC; log with `log.*` (stderr) only.
