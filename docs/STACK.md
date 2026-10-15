# The stack: what to use for every layer, and why

Prices are approximate as of October 2026 and move often. Check each vendor's pricing page before you budget. `vf estimate <project>` uses the numbers in the code, which you can edit.

## The short version

| Layer | Recommended | Monthly cost at 4 videos x 8 min | Why this one |
|---|---|---|---|
| Script, storyboard, fact-check | **Claude Opus 5.5** (Anthropic API) | ~$2-5 | Best long-form explanatory writing, follows the spec schema reliably, and fact-checks with live web search |
| Narration | **ElevenLabs** (`eleven_multilingual_v2`, or `eleven_v3` for more emotion) | $22-99 plan | Returns character-level timestamps with every clip, which is what makes bullets, chart bars and captions land exactly on the spoken word. Top-tier naturalness |
| AI images | **fal.ai** running **Nano Banana Pro** | ~$5-15 | One key, hundreds of models. Nano Banana Pro follows long prompts and holds a consistent style across a video |
| AI video clips | **fal.ai** running **Kling v3 Standard image-to-video** | ~$5-20 | Animates your own generated still, so motion shots match the video's art style. About $0.08/s |
| Stock photos and video | **Pexels API** | Free | Real-world footage (labs, cities, nature) that AI still fakes badly |
| Music | **ElevenLabs Music** | Included in plan credits | Prompt to instrumental bed, cleared for commercial use on paid plans |
| Composition and render | **Remotion 4** | Free (individuals, companies up to 3 people) | React-based motion graphics. Frame-exact, versionable, scriptable. This repo's templates are built on it |
| Mastering | **ffmpeg** two-pass loudnorm to -14 LUFS | Free | Matches YouTube's loudness target |
| Publishing | **YouTube Data API v3** | Free (quota-limited) | Upload, thumbnail, captions, playlist in one command |

Expect roughly **$3-10 per finished 8-minute video** in API spend once you have a voice plan, most of it AI video and images. Motion-graphics-only videos cost under $1.

## Why motion graphics first, AI video second

A factory that generates every shot with AI video sounds like the goal, but it's the wrong default for education:

1. **Learning lives in the graphics.** Diagrams, steps, charts and definitions that build in sync with the narration are what make a concept click. AI video can't render a correct labeled diagram.
2. **Cost.** A 10-minute video of AI footage is 600 seconds at $0.08-0.40/s, so $50-240 per video, before rerolls. The same video in motion graphics with 6 AI stills and 2 AI clips is about $3.
3. **Consistency.** AI clips drift in style and detail from shot to shot. Templates never do.
4. **Accuracy.** AI video confidently invents physics, anatomy and machinery. On an education channel one wrong visual gets screenshotted in the comments.

So this factory uses AI video for 1-2 hero moments per video, AI stills for atmosphere and metaphor, stock for the real world, and templates for everything that teaches.

## Voice: the decision that matters most

Viewers forgive a plain visual. They click away from a voice that grates. Options, best first:

| Option | Quality | Timing data | Cost | Notes |
|---|---|---|---|---|
| ElevenLabs **Professional Voice Clone of you** | Excellent | Character-level | Creator plan and up | Your voice is your channel's identity and the best defense against "AI slop" perception. Needs ~30+ min of clean recordings of yourself |
| ElevenLabs library voice (`eleven_multilingual_v2`) | Excellent | Character-level | ~$0.20 per 1k chars | Default here. Stable, consistent across scenes |
| ElevenLabs `eleven_v3` | Most expressive | Character-level | Same | Supports `[laughs]`, `[whispers]` tags in narration. Slightly less predictable take to take |
| OpenAI `gpt-4o-mini-tts` | Very good | None (estimated) | ~$0.015/min | Cheapest quality option. Steer style with `voice.instructions`. Cues are estimated, so sync is close, not exact |
| Kokoro / Piper (local, via `voice.provider: command`) | Good | None (estimated) | Free | Runs on your machine. Fine for drafts and internal videos |
| `voice.provider: mock` | Silence | Estimated | Free | For layout work and CI |

Narration is generated per scene and cached by content hash, so editing one scene re-bills one scene.

## Images: which model for which look

All of these run through fal.ai; set `providers.imageModel` globally or `visual.model` per scene.

| Model id | Cost | Use for |
|---|---|---|
| `fal-ai/nano-banana-pro` (default) | ~$0.15 | Hero images, consistent illustrated style, complex scenes |
| `fal-ai/flux/schnell` | ~$0.006 | Drafts: storyboard the whole video for pennies, then swap the model for the final |
| `fal-ai/recraft/v3/text-to-image` | ~$0.04 | Flat vector illustration, the classic explainer look |
| `fal-ai/flux-pro/v1.1-ultra` | ~$0.06 | Photoreal |
| OpenAI `gpt-image-1` (`providers.image: openai`) | ~$0.25 | Strong instruction following if you already have an OpenAI key |

The secret to a cohesive look is `style.imageStyle`: one sentence appended to every prompt ("soft flat vector illustration, teal and gold palette, clean shapes, no text"). Keep text out of generated images; the templates set type far better than any image model.

## AI video

| Model id | Cost | Notes |
|---|---|---|
| `fal-ai/kling-video/v3/standard/image-to-video` (default) | ~$0.084/s | Animates the scene's generated still. Best style match |
| `fal-ai/kling-video/v3/pro/image-to-video` | ~$0.112/s | Higher fidelity motion |
| `fal-ai/veo3.1/fast` | ~$0.10/s | Text-to-video, cinematic. fal lists this endpoint as deprecated after Nov 17, 2026, so swap in its successor id when you see it |

Clips are generated muted (narration carries the audio), 3-10 seconds, then slowed slightly or looped to fill the scene.

## Music

| Option | Notes |
|---|---|
| ElevenLabs Music (`music.source: elevenlabs`) | Prompt it like a brief: mood, instruments, tempo, "instrumental". Generates up to 3 minutes and loops |
| Your own file (`music.source: file`) | YouTube Audio Library is free and Content ID safe. Epidemic Sound or Artlist if you want a big catalog (whitelist your channel to avoid claims) |

The renderer ducks music under the voice automatically (`music.volume` when silent, `music.duckTo` under speech) and fades it in and out.

## MCP servers

MCP is the **control surface**, not the production line. Use MCP servers so Claude can explore, audition and edit with you in conversation. The factory itself calls provider APIs directly, because production needs caching, retries, exact costs and the same result every time, none of which you get by routing generation through chat tool calls.

| Server | What it adds | Setup |
|---|---|---|
| **video-factory** (this repo) | Claude can create projects, plan, edit `video.yaml`, lint, estimate, fact-check, build and publish | See [MCP.md](MCP.md) |
| **ElevenLabs MCP** (official) | Audition and design voices, generate sound effects, clone a voice, all in chat | `uvx elevenlabs-mcp` with `ELEVENLABS_API_KEY` |
| **fal MCP** (official, hosted) | Search 1,000+ models, try image and video prompts before committing them to a spec | `claude mcp add --transport http fal-ai https://mcp.fal.ai/mcp --header "Authorization: Bearer $FAL_KEY"` |
| **Remotion MCP** (`@remotion/mcp`) | Remotion docs for Claude when you build new scene templates | `npx @remotion/mcp@latest` |
| **Replicate MCP** (official) | Alternative model catalog | `npx replicate-mcp` with `REPLICATE_API_TOKEN` |
| **Figma MCP** | Pull brand colors, fonts and logos into `style`; design thumbnail variants | Figma Dev Mode MCP |
| **Google Drive** | Drop finished renders and review docs where collaborators can comment | claude.ai connector |
| **GitHub** | Version scripts and specs, review changes as diffs | claude.ai connector |

Exact install commands and client config live in [MCP.md](MCP.md).

## What I'd skip

| Tool type | Why |
|---|---|
| All-in-one "AI video generator" SaaS (text in, video out) | You can't version, template, or fix scene 7 without regenerating everything, and output looks like every other channel using it |
| Avatar presenters | Expensive, uncanny on long-form, and a fast path to the "inauthentic content" bucket |
| Routing all generation through MCP tool calls | No caching or cost control, non-deterministic, slow |
| Hosted render APIs (Shotstack, Creatomate) | Fine for ads; too limited for custom educational motion graphics |
