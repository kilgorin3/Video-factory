import type { SceneSpec, VideoSpecT } from "../spec/schema";
import type { FontFile, Theme, Timeline, TimelineScene, Word } from "../timeline/types";
import type { SceneVisual, VoiceAsset } from "./assets";
import { BASE_SIZES } from "./project";

export type TimelineInput = {
  spec: VideoSpecT;
  theme: Theme;
  slug: string;
  voices: (VoiceAsset | null)[];
  visuals: (SceneVisual | null)[];
  music: string | null;
  logo: string | null;
  fonts?: FontFile[];
  /** Public-dir paths for each scene's sfx files, in spec order. */
  sfxFiles: string[][];
};

const SILENT_DEFAULT: Partial<Record<SceneSpec["type"], number>> = {
  title: 3.5,
  chapter: 3,
  outro: 6,
  quote: 5,
};

/** Seconds a scene needs to stay up regardless of narration (end screens need room). */
function minimumSeconds(s: SceneSpec): number {
  if (s.type === "outro" && s.endScreen) return 8;
  return 2;
}

/**
 * Lay scenes end to end. Transitions overlap the outgoing and incoming scene,
 * so each scene's duration is padded by the next transition's length; that way
 * narration never plays over the half of a transition that belongs to the next scene.
 */
export function buildTimeline(input: TimelineInput): Timeline {
  const { spec, theme, voices, visuals } = input;
  const fps = spec.format.fps;
  const size = BASE_SIZES[spec.format.aspect];
  const f = (sec: number) => Math.round(sec * fps);
  const leadIn = f(spec.pacing.leadIn);

  const transitionIn = spec.scenes.map((s, i) => {
    if (i === 0) return null;
    const type = s.transition ?? spec.style.transition;
    const frames = type === "none" ? 0 : f(spec.style.transitionSeconds);
    return frames > 0 ? { type, durationInFrames: frames } : null;
  });

  // Own (non-overlapping) length of each scene.
  const own = spec.scenes.map((s, i) => {
    const voice = voices[i];
    const natural = voice
      ? spec.pacing.leadIn + voice.durationSec + spec.pacing.tail
      : (s.duration ?? SILENT_DEFAULT[s.type] ?? 3);
    return f(Math.max(natural, s.duration ?? 0, minimumSeconds(s)));
  });

  const scenes: TimelineScene[] = [];
  let cursor = 0;
  let chapterContext: string | null = null;
  const narration: Timeline["audio"]["narration"] = [];
  const speech: Timeline["audio"]["speech"] = [];
  const sfx: Timeline["audio"]["sfx"] = [];
  const captionWords: Word[] = [];

  spec.scenes.forEach((orig, i) => {
    // autoCues assigns generated cue names, so work on a copy of the spec scene.
    const s = structuredClone(orig);
    const tIn = transitionIn[i];
    const tOutFrames = transitionIn[i + 1]?.durationInFrames ?? 0;
    // Transitions can't be longer than the scenes they join.
    const safeIn = tIn ? { ...tIn, durationInFrames: Math.min(tIn.durationInFrames, Math.floor(own[i - 1] / 2), Math.floor(own[i] / 2)) } : null;
    const start = i === 0 ? 0 : cursor - (safeIn?.durationInFrames ?? 0);
    const duration = own[i] + tOutFrames;
    cursor = start + duration;

    const voice = voices[i];
    const words: Word[] = (voice?.words ?? []).map((w) => ({
      text: w.text,
      start: leadIn + f(w.start),
      end: leadIn + Math.max(f(w.end), f(w.start) + 1),
    }));
    const cues: Record<string, number> = {};
    for (const [name, sec] of Object.entries(voice?.cues ?? {})) cues[name] = leadIn + f(sec);
    autoCues(s, cues, voice ? { start: leadIn, end: leadIn + f(voice.durationSec) } : { start: 0, end: own[i] });

    if (voice) {
      narration.push({ src: voice.src, startFrame: start + leadIn, durationInFrames: f(voice.durationSec), scene: i });
      speech.push({ start: start + leadIn, end: start + leadIn + f(voice.durationSec) });
      for (const w of words) captionWords.push({ text: w.text, start: start + w.start, end: start + w.end });
    }

    s.sfx.forEach((fx, k) => {
      const at = typeof fx.at === "number" ? f(fx.at) : (cues[fx.at] ?? 0);
      const src = input.sfxFiles[i]?.[k];
      if (src) sfx.push({ src, frame: start + at, volume: fx.volume });
    });

    if (s.chapter) chapterContext = s.chapter;
    const visual = visuals[i];
    scenes.push({
      id: s.id ?? `scene-${i + 1}`,
      index: i,
      type: s.type,
      startFrame: start,
      durationInFrames: duration,
      transition: safeIn,
      narration: voice ? { start: leadIn, end: leadIn + f(voice.durationSec) } : null,
      words,
      cues,
      visual: visual ? { kind: visual.kind, src: visual.src, fit: visual.fit, kenBurns: visual.kenBurns, credit: visual.credit, durationInFrames: visual.durationInFrames } : null,
      chapter: s.chapter ?? null,
      chapterContext,
      background: s.background ?? null,
      data: s,
    });
  });

  const durationInFrames = cursor;
  const chapters = scenes.filter((s) => s.chapter).map((s) => ({ title: s.chapter!, startFrame: s.startFrame }));
  if (chapters.length && chapters[0].startFrame > 0) chapters.unshift({ title: "Intro", startFrame: 0 });

  const thumbScene = pickThumbnailScene(spec, scenes);
  const portrait = spec.format.aspect === "9:16";

  return {
    version: 1,
    meta: { title: spec.title, slug: input.slug, fps, width: size.width, height: size.height, durationInFrames },
    theme,
    fonts: input.fonts ?? [],
    scenes,
    audio: {
      narration,
      music: input.music ? { src: input.music, volume: spec.music.volume, duckTo: spec.music.duckTo } : null,
      sfx,
      speech,
    },
    captions: {
      enabled: spec.style.captions.enabled,
      style: spec.style.captions.style,
      position: spec.style.captions.position,
      maxChars: spec.style.captions.maxChars ?? (portrait ? 22 : 38),
      words: captionWords,
    },
    chrome: {
      progressBar: spec.style.progressBar,
      chapterLabel: spec.style.chapterLabel,
      logo: input.logo,
    },
    chapters,
    thumbnail: {
      title: spec.youtube.thumbnailText ?? spec.title,
      subtitle: null,
      image: thumbScene?.visual?.kind === "image" ? thumbScene.visual.src : (visuals[thumbScene?.index ?? -1]?.poster ?? null),
    },
  };
}

function pickThumbnailScene(spec: VideoSpecT, scenes: TimelineScene[]): TimelineScene | undefined {
  const pick = spec.youtube.thumbnailScene;
  if (typeof pick === "number") return scenes[pick - 1];
  if (typeof pick === "string") return scenes.find((s) => s.id === pick);
  return scenes.find((s) => s.visual?.kind === "image") ?? scenes.find((s) => s.visual);
}

/**
 * Items without an explicit [[cue]] are spread evenly across the narration so
 * reveals still feel paced to the voice.
 */
function autoCues(s: SceneSpec, cues: Record<string, number>, window: { start: number; end: number }) {
  const items = itemsOf(s);
  if (items.length === 0) return;
  const span = Math.max(1, window.end - window.start);
  items.forEach((item, k) => {
    if (item.cue && cues[item.cue] !== undefined) return;
    const name = item.cue ?? `__auto${k}`;
    cues[name] = window.start + Math.round((span * k) / (items.length + 0.35));
    item.assign(name);
  });
}

type Item = { cue?: string; assign: (name: string) => void };

function itemsOf(s: SceneSpec): Item[] {
  const wrap = <T extends { cue?: string }>(arr: T[]): Item[] =>
    arr.map((x) => ({ cue: x.cue, assign: (name: string) => { x.cue = name; } }));
  switch (s.type) {
    case "bullets":
    case "split":
      return wrap(s.points);
    case "comparison":
      // Interleave left/right so the two columns build together.
      return interleave(wrap(s.left.points), wrap(s.right.points));
    case "chart":
      return wrap(s.data);
    case "steps":
      return wrap(s.steps);
    case "timeline":
      return wrap(s.events);
    case "code":
      return wrap(s.highlights);
    default:
      return [];
  }
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}
