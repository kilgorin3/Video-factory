# Video Factory

Give it a brief or a script, your colors and your voice. Get back a rendered, captioned, loudness-mastered educational video with a thumbnail, chapters and YouTube metadata, ready to upload.

```bash
npm install
npm run vf -- build projects/example-photosynthesis --mock --preset draft   # free, no API keys
```

That renders the bundled 2-minute example (14 scenes, 12 templates) with silent narration and placeholder art in about 4 minutes. Add API keys to `.env` and drop `--mock` for the real thing.

## How it works

1. **Brief** (`vf init`): topic, audience, key points, tone, length. Or paste a finished script.
2. **Storyboard** (`vf plan`): Claude writes `video.yaml`: every scene's template, narration with timing cues, on-screen text, visual prompts, chapters, and YouTube packaging.
3. **Fact-check** (`vf review`): Claude verifies claims with web search and writes a report with fixes and sources.
4. **Build** (`vf build`): ElevenLabs narrates each scene with word-level timing; fal.ai generates images and animates hero shots; Pexels supplies real-world footage; Remotion renders motion graphics that reveal each point on the exact word; ffmpeg masters to YouTube's -14 LUFS.
5. **Publish** (`vf publish`): uploads privately with thumbnail, captions, chapters, tags and the AI disclosure flag set correctly.

Everything is cached per asset, so changing one scene re-bills one scene.

## What you get

| Output | |
|---|---|
| `<slug>.mp4` | H.264 1080p (or 4K), BT.709, -14 LUFS |
| `thumbnail.png` | 1280x720, bold text over the hero image |
| `captions.srt` / `.vtt` | Word-timed, two-line cues |
| `youtube.json` / `.md` | Title, description with chapters and credits, tags, flags |
| `report.md` | Scene timing, editorial checks, spend |
| `manifest.json` | Provider, model, prompt and cost of every generated asset |

**16 scene templates:** title, kinetic typography, chapter, bullets, split, image, video, definition, steps, timeline, comparison, stat, chart (bar, line, donut), quote, code, outro. **8 themes:** midnight, paper, chalkboard, neon, sunrise, ocean, mono, kids, each overridable with your own colors and fonts. Every template works in 16:9, 9:16 and 1:1.

## Commands

| Command | Does |
|---|---|
| `vf init <dir>` | New project with `video.yaml` and `brief.md` |
| `vf plan <dir>` | Claude storyboards the brief or script into `video.yaml` |
| `vf validate <dir>` | Schema and reference checks |
| `vf lint <dir>` | Hook speed, pacing, monotony, pronunciation, contrast, chapters |
| `vf review <dir>` | Fact-check with web search |
| `vf estimate <dir>` | API cost before you spend it |
| `vf build <dir>` | Everything. `--mock`, `--preset draft\|final\|1440p\|4k`, `--aspect 9:16`, `--scenes 3-5` |
| `vf preview <dir>` | Open Remotion Studio on the project |
| `vf thumbnail <dir>` | Thumbnail variants: `--text`, `--scene`, `--out` |
| `vf publish <dir>` | Upload to YouTube |
| `vf youtube-auth` | One-time YouTube login |
| `vf voices` / `themes` / `templates` | List options |

Run them as `npm run vf -- <command>`, or `npm link` once and use `vf` directly. `npm run mcp` starts the MCP server so Claude can drive all of this in conversation.

## Setup

Requires Node 20.11+ and ffmpeg (optional; Remotion's bundled copy is used otherwise).

```bash
npm install
cp .env.example .env    # add the keys you use
npm test
```

| Key | For | Required? |
|---|---|---|
| `ANTHROPIC_API_KEY` | `vf plan`, `vf review` | For planning and fact-checking |
| `ELEVENLABS_API_KEY` | Narration, music | For real voice (or use OpenAI or a local engine) |
| `FAL_KEY` | AI images and video | For generated visuals |
| `PEXELS_API_KEY` | Stock photos and video | Free key, optional |
| `OPENAI_API_KEY` | Alternate TTS and images | Optional |
| `YOUTUBE_CLIENT_ID` / `SECRET` | Publishing | Optional |

Docker: `docker build -t video-factory . && docker run --rm -v $PWD/projects:/app/projects --env-file .env video-factory build projects/example-photosynthesis`.

## Docs

| | |
|---|---|
| [docs/STACK.md](docs/STACK.md) | Which services to use for voice, images, video, music, rendering and MCP, with costs and reasoning |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | Start to finish, idea to published video, with a QA checklist |
| [docs/SPEC.md](docs/SPEC.md) | Every `video.yaml` field and every scene template |
| [docs/MCP.md](docs/MCP.md) | Connecting Claude Desktop / Claude Code, plus provider MCP servers |
| [docs/YOUTUBE.md](docs/YOUTUBE.md) | API setup, quotas, and the policies that matter (inauthentic content, AI disclosure) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How sync, caching and rendering work, and how to extend it |
