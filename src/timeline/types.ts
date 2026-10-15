import type { SceneSpec, SceneType, TransitionType } from "../spec/schema";

/**
 * The timeline is the fully-resolved, frame-accurate render plan.
 * The pipeline writes it (build/timeline.json); Remotion only reads it.
 * Every number here is in frames unless the name says otherwise.
 */

export type ThemeColors = {
  background: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
  muted: string;
  success: string;
  danger: string;
};

export type Theme = {
  name: string;
  dark: boolean;
  colors: ThemeColors;
  fonts: { heading: string; body: string; mono: string };
  motion: "snappy" | "smooth" | "calm";
  background: "gradient" | "mesh" | "grid" | "solid";
  grain: boolean;
  radius: number;
};

export type Word = { text: string; start: number; end: number };

/** A font file vendored into the build (public dir path). */
export type FontFile = { family: string; weight: string; src: string; unicodeRange?: string };

export type VisualAsset = {
  kind: "image" | "video";
  /** Path inside the Remotion public dir, resolved with staticFile(). */
  src: string;
  fit: "cover" | "contain";
  kenBurns: boolean;
  credit?: string;
  /** Clip length in frames (videos only), used to loop short clips. */
  durationInFrames?: number;
};

export type TimelineScene = {
  id: string;
  index: number;
  type: SceneType;
  /** Absolute start frame in the final video. */
  startFrame: number;
  durationInFrames: number;
  /** Transition INTO this scene (overlaps the previous scene). */
  transition: { type: TransitionType; durationInFrames: number } | null;
  /** Narration window relative to scene start. */
  narration: { start: number; end: number } | null;
  /** Spoken words relative to scene start. */
  words: Word[];
  /** Cue name -> frame relative to scene start. */
  cues: Record<string, number>;
  visual: VisualAsset | null;
  chapter: string | null;
  /** Current chapter title (for the corner label), inherited from earlier scenes. */
  chapterContext: string | null;
  background: string | null;
  /** The original scene spec (type-specific fields live here). */
  data: SceneSpec;
};

export type Timeline = {
  version: 1;
  meta: {
    title: string;
    slug: string;
    fps: number;
    width: number;
    height: number;
    durationInFrames: number;
  };
  theme: Theme;
  /** Vendored font files. Undefined = load from Google at render time (Studio demo only). */
  fonts?: FontFile[];
  scenes: TimelineScene[];
  audio: {
    narration: { src: string; startFrame: number; durationInFrames: number; scene: number }[];
    music: { src: string; volume: number; duckTo: number } | null;
    sfx: { src: string; frame: number; volume: number }[];
    /** Absolute frame windows where someone is talking (for music ducking). */
    speech: { start: number; end: number }[];
  };
  captions: {
    enabled: boolean;
    style: "highlight" | "plain";
    position: "bottom" | "top";
    maxChars: number;
    /** Absolute frames. */
    words: Word[];
  };
  chrome: {
    progressBar: boolean;
    chapterLabel: boolean;
    logo: string | null;
  };
  chapters: { title: string; startFrame: number }[];
  thumbnail: { title: string; subtitle: string | null; image: string | null };
};

export type VideoProps = { timeline: Timeline };
