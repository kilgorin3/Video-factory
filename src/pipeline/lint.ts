import { sceneLabel } from "../spec/load";
import type { VideoSpecT } from "../spec/schema";
import { contrastRatio, resolveTheme } from "../spec/themes";
import { parseNarration } from "../text/narration";

/** Narration pace most educational channels land on. */
export const WPM = 150;

export type LintResult = {
  issues: { level: "error" | "warning" | "info"; where: string; message: string }[];
  words: number;
  estimatedSeconds: number;
};

/**
 * Editorial checks that catch the usual retention killers before you spend
 * money: slow hooks, wall-of-narration scenes, monotony, unreadable colors.
 */
export function lintSpec(spec: VideoSpecT): LintResult {
  const issues: LintResult["issues"] = [];
  const add = (level: "error" | "warning" | "info", where: string, message: string) => issues.push({ level, where, message });

  const perScene = spec.scenes.map((s) => parseNarration(s.narration).words.length);
  const words = perScene.reduce((a, b) => a + b, 0);
  const estimatedSeconds =
    spec.scenes.reduce((sec, s, i) => {
      const talk = perScene[i] ? (perScene[i] / WPM) * 60 / spec.voice.speed + spec.pacing.leadIn + spec.pacing.tail : (s.duration ?? 3);
      return sec + Math.max(talk, s.duration ?? 0);
    }, 0);

  // Hook
  const hookWords = perScene[0] ?? 0;
  if (hookWords > 40) {
    add("warning", "scenes[0]", `The opening scene runs ~${Math.round((hookWords / WPM) * 60)}s. State the payoff in the first 10-15s, then move.`);
  }
  if (spec.scenes[0] && !spec.scenes[0].narration.trim() && (spec.scenes[0].duration ?? 3.5) > 4) {
    add("warning", "scenes[0]", "Silent intro longer than 4s. Viewers decide in the first seconds; start talking.");
  }

  spec.scenes.forEach((s, i) => {
    const where = sceneLabel(s, i);
    const n = perScene[i];
    const secs = (n / WPM) * 60;
    const hasReveals = /\[\[/.test(s.narration) || ["bullets", "steps", "timeline", "chart", "comparison", "kinetic", "code", "video"].includes(s.type);
    if (secs > 35 && !hasReveals) add("warning", where, `~${Math.round(secs)}s on one static frame. Split it, or add [[cues]] so something changes every 6-10s.`);
    if (secs > 60) add("warning", where, `~${Math.round(secs)}s of narration in one scene. Split it.`);

    for (const sentence of s.narration.split(/(?<=[.!?])\s+/)) {
      const len = sentence.split(/\s+/).filter(Boolean).length;
      if (len > 32) add("info", where, `A ${len}-word sentence. Long sentences are hard to follow by ear.`);
    }

    const acronyms = [...new Set(s.narration.match(/\b[A-Z]{2,6}s?\b/g) ?? [])].filter(
      (a) => !(a in spec.pronunciations) && !["I", "OK", "TV", "US", "UK", "AI"].includes(a),
    );
    if (acronyms.length) add("info", where, `Check how TTS says ${acronyms.join(", ")}. Add to pronunciations if it says it wrong.`);
    if (/\d+(\.\d+)?x\b|\d\^\d|≈|±|\b\d+\s?[a-zA-Z]{1,3}\/[a-zA-Z]{1,3}\b/.test(s.narration)) {
      add("info", where, "Narration has symbols or units (1.5x, km/h, ^). Spell them out the way they should be spoken.");
    }
    if (s.type === "stat" && !s.source) add("info", where, "Stat without a source. Educational audiences notice; add `source`.");
  });

  // Monotony
  for (let i = 2; i < spec.scenes.length; i++) {
    const t = spec.scenes[i].type;
    if (t === spec.scenes[i - 1].type && t === spec.scenes[i - 2].type) {
      add("warning", sceneLabel(spec.scenes[i], i), `Three ${t} scenes in a row. Vary the layout to hold attention.`);
    }
  }

  // Length vs scope
  const target = spec.scope.targetMinutes;
  if (target) {
    const ratio = estimatedSeconds / 60 / target;
    if (ratio < 0.8 || ratio > 1.2) {
      add("warning", "scope.targetMinutes", `Script runs ~${(estimatedSeconds / 60).toFixed(1)} min vs a ${target} min target.`);
    }
  }

  // Chapters
  const chapters = spec.scenes.filter((s) => s.chapter).length;
  if (estimatedSeconds > 180 && chapters < 2) {
    add("info", "chapters", "Over 3 minutes with fewer than 3 chapters. Chapters (scene.chapter) help search and retention.");
  }

  // End screen
  const outro = spec.scenes[spec.scenes.length - 1];
  if (outro?.type === "outro" && outro.endScreen && estimatedSeconds < 25) {
    add("warning", "outro", "YouTube end screens need a video of at least 25 seconds.");
  }
  if (spec.format.aspect === "9:16" && estimatedSeconds > 180) {
    add("warning", "format.aspect", "Vertical video over 3 minutes won't be treated as a Short.");
  }

  // Colors
  try {
    const theme = resolveTheme(spec.style);
    const c = theme.colors;
    if (contrastRatio(c.text, c.background) < 4.5) add("warning", "style.colors", "Text vs background contrast is under 4.5:1.");
    if (contrastRatio(c.accent, c.background) < 2.5) add("info", "style.colors", "Accent color is hard to see on the background.");
  } catch {
    /* reported by checkSpec */
  }

  // Disclosure
  if (spec.scenes.some((s) => s.visual?.source === "ai-video") && spec.youtube.containsSyntheticMedia === false) {
    add("warning", "youtube.containsSyntheticMedia", "AI video is used but disclosure is off. Realistic synthetic footage must be disclosed on YouTube.");
  }
  if (!spec.youtube.description) add("info", "youtube.description", "No description yet. The first two lines show in search.");
  if (!spec.youtube.tags.length) add("info", "youtube.tags", "No tags.");

  return { issues, words, estimatedSeconds };
}
