# Start to finish: idea to published video

This is the full playbook. Commands assume you're in the repo root and use `npm run vf --` (or `vf` after `npm link`).

| Stage | Command | Your time | Machine time | Cost |
|---|---|---|---|---|
| 1. Brief | `vf init` | 15-30 min | | |
| 2. Storyboard | `vf plan` | | 2-4 min | ~$0.40 |
| 3. Edit the spec | your editor or Claude via MCP | 20-40 min | | |
| 4. Fact-check | `vf review` | 5 min to read | 1-3 min | ~$0.30 |
| 5. Lint + estimate | `vf lint`, `vf estimate` | 2 min | seconds | |
| 6. Mock render | `vf build --mock --preset draft` | 10 min to watch | 3-5 min | $0 |
| 7. Real build | `vf build` | | 10-30 min | $3-10 |
| 8. QA | watch the final | 10-15 min | | |
| 9. Publish | `vf publish` | 10 min in Studio | 2-5 min | |

## 1. Write the brief

```bash
npm run vf -- init projects/black-holes --title "What Actually Happens Inside a Black Hole" --theme midnight
```

This creates `video.yaml` (settings and a starter scene list) and `brief.md`. Fill in the brief: topic, audience, the promise ("by the end you'll understand..."), key points in order, must-include facts with sources, things to avoid, length and tone.

Already have a finished script? Save it as `script.md` instead. The planner keeps your wording and only splits it into scenes, adds cues, picks templates and writes visual prompts.

Set your look before planning, in `video.yaml`: `style.theme`, any `colors` and `fonts` overrides, `style.imageStyle`, `voice`, `music`. The planner keeps whatever you set.

## 2. Storyboard with Claude

```bash
npm run vf -- plan projects/black-holes
```

Claude writes every scene: template choice, narration with `[[cue]]` markers, on-screen text, visual prompts, chapters, and YouTube title, description, tags and thumbnail text. The result is validated against the schema and the cue references; if anything's off, Claude gets the exact errors and fixes them (up to 3 rounds). You get a lint summary and cost estimate at the end.

## 3. Edit the spec

`video.yaml` is the source of truth. Read every narration line out loud. Things worth changing by hand:

| Look for | Fix |
|---|---|
| A slow open | Cut until the payoff is stated in the first 10 seconds |
| A scene that says what's already on screen | Make the narration add detail the bullets don't |
| Generic visual prompts | Add a concrete subject, composition, and one striking detail |
| Words the voice will mangle | Add them to `pronunciations` |
| A fact you're not sure of | Mark it, then check it in step 4 |

Prefer to edit by conversation? With the MCP server connected, ask Claude to "tighten scene 4 and swap it to a comparison" and it rewrites `video.yaml` through `update_spec`, which validates before saving.

## 4. Fact-check

```bash
npm run vf -- review projects/black-holes
```

Claude reads every claim, stat, chart and definition, verifies the shaky ones with web search, and writes `build/review.md` with verdicts, suggested rewrites and sources. Educational audiences are unforgiving about errors and a pinned correction costs you more than this step.

## 5. Lint and estimate

```bash
npm run vf -- lint projects/black-holes
npm run vf -- estimate projects/black-holes
```

Lint flags slow hooks, scenes that hold one static frame too long, three identical templates in a row, unexplained acronyms, symbols the voice will read wrong, poor color contrast, chapters YouTube won't accept, and missing disclosure. Estimate prices a full uncached build.

## 6. Mock render (free)

```bash
npm run vf -- build projects/black-holes --mock --preset draft
```

Silent narration timed to a natural reading speed, on-brand placeholder art, no music, 540p. You see every layout, transition and reveal for $0. Iterate here until the structure feels right.

Scrub interactively instead of re-rendering:

```bash
npm run vf -- preview projects/black-holes
```

This opens Remotion Studio on the project's timeline. Changes to templates in `src/remotion` hot-reload.

## 7. Real build

```bash
npm run vf -- build projects/black-holes            # 1080p
npm run vf -- build projects/black-holes --preset 4k  # 4K: better YouTube bitrate even for 1080p viewers
```

What happens, in order:

1. Narration per scene (cached), with exact word and cue timings.
2. Visuals per scene (cached): images, stills animated into clips, stock.
3. Theme fonts downloaded into the build so renders never hit the network.
4. Timeline: every scene, cue, word and audio clip resolved to an exact frame.
5. Music generated to length (cached), ducked under the voice.
6. Remotion renders the video (H.264, BT.709, yuv420p, CRF 17).
7. Audio mastered to -14 LUFS, true peak -1 dBTP; `+faststart` for streaming.
8. Thumbnail rendered, SRT and VTT captions written, YouTube metadata with chapters written, build report written.

Outputs land in `projects/<name>/build/out/`:

| File | What it is |
|---|---|
| `<slug>.mp4` | The finished video |
| `thumbnail.png` | 1280x720 thumbnail |
| `captions.srt`, `captions.vtt` | Upload as a caption track (better for search and accessibility than burned-in alone) |
| `youtube.json`, `youtube.md` | Title, description with chapters and credits, tags, flags |
| `report.md` | Scene timing table, editorial checks, spend |
| `../manifest.json` | Every generated asset: provider, model, prompt, cost |

Re-rendering a single section while you fix it:

```bash
npm run vf -- build projects/black-holes --scenes 4-6 --preset draft
```

Cutting a vertical Short from the same script:

```bash
npm run vf -- build projects/black-holes --aspect 9:16
```

Every template is responsive and keeps clear of the Shorts UI. Vertical videos must be 3 minutes or less to count as Shorts, so a Short is usually its own shorter spec.

## 8. QA checklist

Watch the whole thing once at full screen and once on a phone.

| Check | |
|---|---|
| Every fact matches `review.md` | |
| No mispronounced words (fix with `pronunciations`, rebuild only re-bills that scene) | |
| Reveals land on the right words | |
| Nothing important is hidden behind captions or (for Shorts) the Shorts UI | |
| AI images have no garbled text, extra fingers, or wrong science | |
| Music never fights the voice | |
| Chapters in `youtube.md` look right (YouTube needs 3+, first at 0:00, each 10s+) | |
| The thumbnail reads at phone size | |

## 9. Publish

One-time setup is in [YOUTUBE.md](YOUTUBE.md). Then:

```bash
npm run vf -- publish projects/black-holes
```

Uploads the video as **private** by default with title, description, tags, category, language, made-for-kids, the altered/synthetic content flag, the thumbnail, the caption track and the playlist. Then, in YouTube Studio:

1. Add end-screen elements over the outro (the API can't set them; the outro reserves space for two videos and a subscribe button).
2. Turn on "Test & compare" with 2-3 thumbnail variants if you have them.
3. Check the auto-generated chapters and captions.
4. Schedule or publish.

## After publishing

Pin a comment with sources from `review.md`. At 48 hours, check retention in YouTube Analytics: the dips tell you which scene types and pacing to change in the next spec. Feed those learnings back into your brief template.
