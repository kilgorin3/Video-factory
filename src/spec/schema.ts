import { z } from "zod";

/**
 * The video spec (video.yaml) is the single source of truth for a video.
 * Everything downstream (voice, visuals, timeline, render, YouTube metadata)
 * is derived from it, so a human can review and edit one file.
 */

export const TRANSITIONS = ["fade", "slide", "wipe", "zoom", "none"] as const;
export const Transition = z.enum(TRANSITIONS);
export type TransitionType = z.infer<typeof Transition>;

export const VISUAL_SOURCES = [
  "ai-image",
  "ai-video",
  "stock-image",
  "stock-video",
  "file",
  "none",
] as const;

export const Visual = z.object({
  /** Where the visual comes from. ai-video = generate a still, then animate it (image-to-video). */
  source: z.enum(VISUAL_SOURCES).default("ai-image"),
  /** Image/video generation prompt. style.imageStyle is appended automatically. */
  prompt: z.string().optional(),
  /** Motion prompt for ai-video (what moves, camera move). Falls back to prompt. */
  motion: z.string().optional(),
  /** Search query for stock sources. Falls back to prompt. */
  query: z.string().optional(),
  /** Path relative to the project folder for source=file. */
  file: z.string().optional(),
  /** Override the provider model for this one visual. */
  model: z.string().optional(),
  seed: z.number().int().optional(),
  fit: z.enum(["cover", "contain"]).default("cover"),
  /** Slow push/pan on stills. */
  kenBurns: z.boolean().default(true),
  /** Attribution text shown small in the corner (stock licenses often want it). */
  credit: z.string().optional(),
});
export type VisualSpec = z.infer<typeof Visual>;

const Sfx = z.object({
  file: z.string(),
  /** Seconds from scene start, or a cue name from the narration. */
  at: z.union([z.number(), z.string()]).default(0),
  volume: z.number().min(0).max(1).default(0.6),
});

/** A point that can be revealed in sync with the narration via a [[cue]] marker. */
const Point = z.union([
  z.string().transform((text) => ({ text, cue: undefined as string | undefined })),
  z.object({ text: z.string(), cue: z.string().optional() }),
]);
export type PointSpec = z.infer<typeof Point>;

const base = {
  id: z.string().optional(),
  /** Starting a chapter here adds a YouTube chapter marker and a lower-third label. */
  chapter: z.string().optional(),
  /** What the narrator says. Insert [[name]] markers to sync reveals to words. */
  narration: z.string().default(""),
  /** Minimum on-screen seconds. Required for silent scenes. */
  duration: z.number().positive().optional(),
  /** Transition INTO this scene. */
  transition: Transition.optional(),
  visual: Visual.optional(),
  /** Background override: a hex color, or "visual" to put the scene visual behind the content. */
  background: z.string().optional(),
  sfx: z.array(Sfx).default([]),
  /** Free-form notes for humans. Ignored by the pipeline. */
  notes: z.string().optional(),
};

export const TitleScene = z.object({
  type: z.literal("title"),
  ...base,
  title: z.string(),
  subtitle: z.string().optional(),
  kicker: z.string().optional(),
});

export const ChapterScene = z.object({
  type: z.literal("chapter"),
  ...base,
  number: z.union([z.number(), z.string()]).optional(),
  title: z.string(),
  subtitle: z.string().optional(),
});

export const BulletsScene = z.object({
  type: z.literal("bullets"),
  ...base,
  heading: z.string(),
  points: z.array(Point).min(1).max(8),
  numbered: z.boolean().default(false),
  /** Dim earlier points when a new one appears. */
  focus: z.boolean().default(true),
});

export const ImageScene = z.object({
  type: z.literal("image"),
  ...base,
  caption: z
    .object({ title: z.string().optional(), text: z.string().optional() })
    .optional(),
});

export const VideoScene = z.object({
  type: z.literal("video"),
  ...base,
  caption: z
    .object({ title: z.string().optional(), text: z.string().optional() })
    .optional(),
  /** Keep the clip's own audio (most b-roll should stay muted under narration). */
  keepAudio: z.boolean().default(false),
});

export const SplitScene = z.object({
  type: z.literal("split"),
  ...base,
  heading: z.string(),
  body: z.string().optional(),
  points: z.array(Point).max(6).default([]),
  side: z.enum(["left", "right"]).default("right"),
});

export const QuoteScene = z.object({
  type: z.literal("quote"),
  ...base,
  quote: z.string(),
  author: z.string().optional(),
  role: z.string().optional(),
});

export const StatScene = z.object({
  type: z.literal("stat"),
  ...base,
  value: z.number(),
  prefix: z.string().default(""),
  suffix: z.string().default(""),
  decimals: z.number().int().min(0).max(4).default(0),
  label: z.string(),
  context: z.string().optional(),
  /** Cite where the number comes from. Shown small under the stat. */
  source: z.string().optional(),
});

const ChartDatum = z.object({
  label: z.string(),
  value: z.number(),
  color: z.string().optional(),
  cue: z.string().optional(),
});

export const ChartScene = z.object({
  type: z.literal("chart"),
  ...base,
  chart: z.enum(["bar", "line", "donut"]).default("bar"),
  title: z.string().optional(),
  unit: z.string().default(""),
  data: z.array(ChartDatum).min(1).max(12),
  source: z.string().optional(),
  highlight: z.string().optional(),
});

export const StepsScene = z.object({
  type: z.literal("steps"),
  ...base,
  heading: z.string().optional(),
  steps: z
    .array(
      z.object({
        title: z.string(),
        text: z.string().optional(),
        cue: z.string().optional(),
      }),
    )
    .min(2)
    .max(6),
});

export const TimelineScene = z.object({
  type: z.literal("timeline"),
  ...base,
  heading: z.string().optional(),
  events: z
    .array(
      z.object({
        date: z.string(),
        title: z.string(),
        text: z.string().optional(),
        cue: z.string().optional(),
      }),
    )
    .min(2)
    .max(7),
});

const Column = z.object({
  title: z.string(),
  points: z.array(Point).min(1).max(6),
  tone: z.enum(["neutral", "good", "bad"]).default("neutral"),
});

export const ComparisonScene = z.object({
  type: z.literal("comparison"),
  ...base,
  heading: z.string().optional(),
  left: Column,
  right: Column,
});

export const CodeScene = z.object({
  type: z.literal("code"),
  ...base,
  title: z.string().optional(),
  language: z.string().default("typescript"),
  code: z.string(),
  /** Highlight line ranges like "3-5" or "7", optionally at a cue. */
  highlights: z
    .array(z.object({ lines: z.string(), cue: z.string().optional() }))
    .default([]),
});

export const DefinitionScene = z.object({
  type: z.literal("definition"),
  ...base,
  term: z.string(),
  phonetic: z.string().optional(),
  partOfSpeech: z.string().optional(),
  definition: z.string(),
  example: z.string().optional(),
});

export const KineticScene = z.object({
  type: z.literal("kinetic"),
  ...base,
  /** Words to color with the accent when they appear. */
  emphasis: z.array(z.string()).default([]),
});

export const OutroScene = z.object({
  type: z.literal("outro"),
  ...base,
  title: z.string().default("Thanks for watching"),
  cta: z.string().optional(),
  subscribe: z.boolean().default(true),
  /** Reserve space for YouTube end-screen elements (needs 5-20s of runtime). */
  endScreen: z.boolean().default(true),
});

export const Scene = z.discriminatedUnion("type", [
  TitleScene,
  ChapterScene,
  BulletsScene,
  ImageScene,
  VideoScene,
  SplitScene,
  QuoteScene,
  StatScene,
  ChartScene,
  StepsScene,
  TimelineScene,
  ComparisonScene,
  CodeScene,
  DefinitionScene,
  KineticScene,
  OutroScene,
]);
export type SceneSpec = z.infer<typeof Scene>;
export type SceneType = SceneSpec["type"];
export type SceneOf<T extends SceneType> = Extract<SceneSpec, { type: T }>;
export const SCENE_TYPES = Scene.options.map((o) => o.shape.type.value) as SceneType[];

const Hex = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Use a hex color like #1E2A78");

export const Style = z.object({
  /** Theme preset name (vf themes lists them). colors/fonts below override it. */
  theme: z.string().default("midnight"),
  colors: z
    .object({
      background: Hex,
      surface: Hex,
      primary: Hex,
      accent: Hex,
      text: Hex,
      muted: Hex,
      success: Hex,
      danger: Hex,
    })
    .partial()
    .default({}),
  fonts: z
    .object({ heading: z.string(), body: z.string(), mono: z.string() })
    .partial()
    .default({}),
  motion: z.enum(["snappy", "smooth", "calm"]).optional(),
  background: z.enum(["gradient", "mesh", "grid", "solid"]).optional(),
  grain: z.boolean().optional(),
  transition: Transition.default("fade"),
  transitionSeconds: z.number().min(0).max(2).default(0.5),
  captions: z
    .object({
      enabled: z.boolean().default(true),
      style: z.enum(["highlight", "plain"]).default("highlight"),
      position: z.enum(["bottom", "top"]).default("bottom"),
      maxChars: z.number().int().min(12).max(80).optional(),
    })
    .prefault({}),
  progressBar: z.boolean().default(true),
  chapterLabel: z.boolean().default(true),
  /** Logo file relative to the project folder, shown as a corner watermark. */
  logo: z.string().optional(),
  /** Appended to every AI image/video prompt so the whole video shares one look. */
  imageStyle: z.string().default(""),
  negativePrompt: z.string().default("text, letters, watermark, logo, blurry, distorted"),
});
export type StyleSpec = z.infer<typeof Style>;

export const Voice = z.object({
  provider: z.enum(["elevenlabs", "openai", "command", "mock"]).default("elevenlabs"),
  /** ElevenLabs voice id, or OpenAI voice name (alloy, coral, sage, ...). */
  voiceId: z.string().optional(),
  model: z.string().optional(),
  /** OpenAI gpt-4o-mini-tts style direction ("warm, curious teacher"). */
  instructions: z.string().optional(),
  speed: z.number().min(0.7).max(1.2).default(1),
  stability: z.number().min(0).max(1).optional(),
  similarity: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  seed: z.number().int().optional(),
  /**
   * Send neighbouring scenes' text to ElevenLabs for smoother prosody across cuts.
   * Off by default: it ties each scene's cached audio to its neighbours, so editing
   * one scene re-bills three.
   */
  context: z.boolean().default(false),
  /** For provider=command: shell template with {text_file} and {out_file} placeholders. */
  command: z.string().optional(),
});
export type VoiceSpec = z.infer<typeof Voice>;

export const Music = z.object({
  source: z.enum(["none", "file", "elevenlabs"]).default("none"),
  file: z.string().optional(),
  prompt: z.string().optional(),
  model: z.string().optional(),
  /** Bed level when nobody is talking (0-1). */
  volume: z.number().min(0).max(1).default(0.22),
  /** Bed level under narration (0-1). */
  duckTo: z.number().min(0).max(1).default(0.07),
});

export const YouTube = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  /** 27 = Education */
  categoryId: z.string().default("27"),
  privacy: z.enum(["private", "unlisted", "public"]).default("private"),
  madeForKids: z.boolean().default(false),
  /** "auto" flags the upload as altered/synthetic when any ai-video visual is used. */
  containsSyntheticMedia: z.union([z.boolean(), z.literal("auto")]).default("auto"),
  language: z.string().default("en"),
  thumbnailText: z.string().optional(),
  /** Scene index (1-based) or id whose visual becomes the thumbnail background. */
  thumbnailScene: z.union([z.number().int().positive(), z.string()]).optional(),
  playlistId: z.string().optional(),
  uploadCaptions: z.boolean().default(true),
});

export const VideoSpec = z.object({
  version: z.literal(1).default(1),
  title: z.string().min(3),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, numbers and dashes")
    .optional(),
  format: z
    .object({
      aspect: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
      fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(50), z.literal(60)]).default(30),
    })
    .prefault({}),
  scope: z
    .object({
      audience: z.string(),
      level: z.enum(["beginner", "intermediate", "advanced"]),
      targetMinutes: z.number().positive(),
      tone: z.string(),
      objectives: z.array(z.string()),
      language: z.string(),
    })
    .partial()
    .default({}),
  style: Style.prefault({}),
  voice: Voice.prefault({}),
  music: Music.prefault({}),
  providers: z
    .object({
      image: z.enum(["fal", "openai", "pexels", "placeholder"]).default("fal"),
      video: z.enum(["fal", "pexels", "placeholder"]).default("fal"),
      imageModel: z.string().optional(),
      videoModel: z.string().optional(),
    })
    .prefault({}),
  /** Word -> how to say it. Captions keep the original spelling. */
  pronunciations: z.record(z.string(), z.string()).default({}),
  pacing: z
    .object({
      /** Silence before narration starts in each scene (s). */
      leadIn: z.number().min(0).max(2).default(0.35),
      /** Breathing room after narration ends (s). */
      tail: z.number().min(0).max(3).default(0.6),
    })
    .prefault({}),
  scenes: z.array(Scene).min(1),
  youtube: YouTube.prefault({}),
});
export type VideoSpecInput = z.input<typeof VideoSpec>;
export type VideoSpecT = z.infer<typeof VideoSpec>;
