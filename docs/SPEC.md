# video.yaml reference

One file describes the whole video. The schema lives in [`src/spec/schema.ts`](../src/spec/schema.ts); `vf validate` checks a file against it and against cross-references (cues, files).

## Top level

| Key | Default | Meaning |
|---|---|---|
| `title` | required | Working title; also the default YouTube title |
| `slug` | from title | Output file name |
| `format.aspect` | `16:9` | `16:9`, `9:16` (Shorts), `1:1` |
| `format.fps` | `30` | 24, 25, 30, 50, 60 |
| `scope` | `{}` | `audience`, `level`, `targetMinutes`, `tone`, `objectives`, `language`. Guides the planner and lint |
| `style` | see below | Look and feel |
| `voice` | see below | Narration engine |
| `music` | `source: none` | Background bed |
| `providers` | `image: fal`, `video: fal` | Where visuals come from |
| `pronunciations` | `{}` | `word: how to say it`. Changes TTS only; captions keep the spelling |
| `pacing.leadIn` | `0.35` | Seconds of quiet before each scene's narration |
| `pacing.tail` | `0.6` | Seconds after narration before the next transition |
| `scenes` | required | The video, in order |
| `youtube` | see below | Upload metadata |

## style

| Key | Default | Meaning |
|---|---|---|
| `theme` | `midnight` | Preset: `midnight`, `paper`, `chalkboard`, `neon`, `sunrise`, `ocean`, `mono`, `kids` (`vf themes`) |
| `colors` | | Override any of `background`, `surface`, `primary`, `accent`, `text`, `muted`, `success`, `danger` (hex) |
| `fonts` | | Override `heading`, `body`, `mono`. Built-in: Archivo, DM Sans, Figtree, Fira Code, Fraunces, IBM Plex Mono, IBM Plex Sans, Inter, JetBrains Mono, Lexend, Lora, Manrope, Merriweather, Montserrat, Nunito, Outfit, Playfair Display, Plus Jakarta Sans, Poppins, Sora, Space Grotesk, Space Mono, Urbanist |
| `motion` | from theme | `snappy`, `smooth`, `calm` (spring feel of every animation) |
| `background` | from theme | `gradient`, `mesh`, `grid`, `solid` |
| `grain` | from theme | Film grain overlay (also prevents gradient banding after YouTube compression) |
| `transition` | `fade` | Default between scenes: `fade`, `slide`, `wipe`, `zoom`, `none` |
| `transitionSeconds` | `0.5` | |
| `captions.enabled` | `true` | Burned-in captions (a separate SRT is always written too) |
| `captions.style` | `highlight` | `highlight` colors the spoken word; `plain` |
| `captions.position` | `bottom` | `bottom`, `top` |
| `captions.maxChars` | 38 (22 vertical) | Characters per caption line |
| `progressBar` | `true` | Chapter-segmented progress bar on top |
| `chapterLabel` | `true` | Current chapter pill, top left |
| `logo` | | Path to a logo file, shown top right |
| `imageStyle` | `""` | Appended to every AI prompt. The key to a cohesive look |
| `negativePrompt` | text, watermark... | Things AI images should avoid |

## voice

| Key | Default | Meaning |
|---|---|---|
| `provider` | `elevenlabs` | `elevenlabs`, `openai`, `command`, `mock` |
| `voiceId` | George (ElevenLabs) / `coral` (OpenAI) | `vf voices` lists your ElevenLabs voices |
| `model` | `eleven_multilingual_v2` / `gpt-4o-mini-tts` | `eleven_v3` enables `[laughs]`-style audio tags |
| `speed` | `1` | 0.7-1.2 |
| `stability`, `similarity`, `style` | provider defaults | ElevenLabs voice settings |
| `instructions` | warm educator | OpenAI style direction |
| `context` | `false` | Send neighbouring scenes' text to ElevenLabs for smoother joins (ties each scene's cache to its neighbours) |
| `command` | | For `provider: command`: shell template with `{text_file}` and `{out_file}` |
| `seed` | | Reproducible takes |

## music

| Key | Default | Meaning |
|---|---|---|
| `source` | `none` | `none`, `file`, `elevenlabs` |
| `file` | | Path for `source: file` |
| `prompt` | | For `source: elevenlabs` |
| `volume` | `0.22` | Level with nobody talking |
| `duckTo` | `0.07` | Level under narration |

## providers

| Key | Default | Meaning |
|---|---|---|
| `image` | `fal` | `fal`, `openai`, `pexels`, `placeholder` for `ai-image` visuals |
| `video` | `fal` | `fal`, `pexels`, `placeholder` for `ai-video` visuals |
| `imageModel` | `fal-ai/nano-banana-pro` | Any fal image model id |
| `videoModel` | `fal-ai/kling-video/v3/standard/image-to-video` | Any fal video model id |

## youtube

| Key | Default | Meaning |
|---|---|---|
| `title`, `description`, `tags` | | Description gets chapters and credits appended |
| `categoryId` | `27` | Education |
| `privacy` | `private` | `private`, `unlisted`, `public` |
| `madeForKids` | `false` | |
| `containsSyntheticMedia` | `auto` | `auto` = on when AI video is used |
| `language` | `en` | |
| `thumbnailText` | title | 2-5 words |
| `thumbnailScene` | first scene with an image | 1-based index or scene id |
| `playlistId` | | |
| `uploadCaptions` | `true` | |

## Every scene

| Key | Meaning |
|---|---|
| `type` | Template, see below |
| `id` | Optional name (used by `thumbnailScene`) |
| `chapter` | Starts a YouTube chapter and the chapter label |
| `narration` | What's said. `[[name]]` marks a cue; `[tag]` is an ElevenLabs v3 audio tag |
| `duration` | Minimum seconds on screen; required for silent scenes |
| `transition` | Transition into this scene |
| `visual` | See below |
| `background` | `visual` (scene visual behind the content, darkened) or a hex color |
| `sfx` | `[{file, at, volume}]`, `at` is seconds or a cue name |
| `notes` | For humans; ignored |

### visual

| Key | Meaning |
|---|---|
| `source` | `ai-image`, `ai-video` (generate a still, then animate it), `stock-image`, `stock-video`, `file`, `none` |
| `prompt` | What to generate. Content and composition; `style.imageStyle` is appended |
| `motion` | For `ai-video`: what moves and how the camera moves |
| `query` | For stock: search terms |
| `file` | For `file`: path relative to the project |
| `model`, `seed` | Per-visual overrides |
| `fit` | `cover` or `contain` |
| `kenBurns` | Slow push/pan on stills (default on) |
| `credit` | Attribution text (stock sets this automatically) |

### Cues

Put `[[name]]` right before the words that introduce an item, and give the item the same `cue`. The item appears the moment those words are spoken. Items without a cue are spread evenly over the narration.

```yaml
- type: bullets
  heading: Three kinds of rock
  points:
    - { text: Igneous, from cooled magma, cue: ig }
    - { text: Sedimentary, from layers, cue: sed }
    - { text: Metamorphic, from heat and pressure, cue: meta }
  narration: >
    [[ig]] Igneous rock forms when magma cools. [[sed]] Sedimentary rock builds up in layers,
    and [[meta]] metamorphic rock is either one, transformed by heat and pressure.
```

## Templates

### title
```yaml
- type: title
  kicker: Physics in 5 minutes
  title: Why Is the Sky Blue?
  subtitle: It's not reflecting the ocean
  narration: ...
  visual: { source: ai-image, prompt: ... }   # optional backdrop
```

### kinetic
Narration appears huge, phrase by phrase, on the beat of the voice. Use for hooks and punchlines.
```yaml
- type: kinetic
  emphasis: [blue, scattered]
  narration: Sunlight is every color at once. But blue gets scattered the most.
```

### chapter
```yaml
- type: chapter
  chapter: The physics
  title: The physics
  subtitle: Meet Rayleigh scattering
  narration: Here's what's actually happening.
```

### bullets
```yaml
- type: bullets
  heading: ...
  numbered: true        # numbers instead of dots
  focus: true           # earlier points dim as new ones appear
  points: [...]         # up to 8, strings or {text, cue}
  visual: { ... }       # optional image card beside the list
```

### split
```yaml
- type: split
  heading: ...
  body: One or two sentences.
  points: [...]          # optional, up to 6
  side: right            # image side
  visual: { ... }        # required
```

### image / video
```yaml
- type: image            # or video
  caption: { title: The Calvin cycle, text: No light needed }
  keepAudio: false       # video only: keep the clip's own sound
  visual: { source: ai-video, prompt: ..., motion: slow orbit }
```

### definition
```yaml
- type: definition
  term: Entropy
  phonetic: /ˈen.trə.pi/
  partOfSpeech: noun
  definition: ...
  example: ...
```

### steps
```yaml
- type: steps
  heading: ...
  steps:                 # 2-6
    - { title: Capture light, text: Chlorophyll absorbs photons, cue: s1 }
```

### timeline
```yaml
- type: timeline
  heading: ...
  events:                # 2-7
    - { date: "1905", title: Special relativity, text: ..., cue: e1 }
```

### comparison
```yaml
- type: comparison
  heading: Myth vs fact
  left:  { title: Myth, tone: bad,  points: [...] }   # tone: good | bad | neutral
  right: { title: Fact, tone: good, points: [...] }
```

### stat
```yaml
- type: stat
  value: 8.3
  decimals: 1
  suffix: " min"
  label: for sunlight to reach Earth
  context: ...
  source: NASA
```

### chart
```yaml
- type: chart
  chart: bar             # bar | line | donut
  title: ...
  unit: "%"
  highlight: Ocean       # label to emphasize
  source: ...
  data:                  # 1-12
    - { label: Ocean, value: 46, cue: ocean }
```

### quote
```yaml
- type: quote
  quote: ...
  author: Richard Feynman
  role: Physicist
```

### code
```yaml
- type: code
  title: fib.py
  language: python
  code: |
    def fib(n):
        ...
  highlights:
    - { lines: "2-3", cue: base }
```

### outro
```yaml
- type: outro
  title: Thanks for watching
  cta: Next, why sunsets are red.
  subscribe: true
  endScreen: true        # reserves space for YouTube end-screen elements; keeps the scene 8s+
```

## Adding your own template

1. Add a zod schema for it in `src/spec/schema.ts` and include it in the `Scene` union.
2. Write a component in `src/remotion/scenes/` using `useSceneData()`, `useScene().cues`, `useLayout()` and `useTheme()`.
3. Register it in `src/remotion/scenes/index.tsx`.
4. If its items reveal on cues, add it to `referencedCues` (`src/spec/load.ts`) and `itemsOf` (`src/pipeline/timeline.ts`).
5. Describe it in the planner prompt (`src/planner/prompts.ts`) so Claude uses it.
