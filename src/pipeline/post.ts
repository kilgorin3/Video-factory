import { execFile } from "node:child_process";
import { rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { VideoSpecT } from "../spec/schema";
import { chapterStamp, toSRT, toVTT } from "../text/captions";
import type { Timeline } from "../timeline/types";
import { ensureDir, writeJSON } from "../util/fsx";
import { log } from "../util/log";
import type { Manifest } from "./manifest";

const run = promisify(execFile);

async function ffmpeg(args: string[]) {
  const bin = process.env.FFMPEG_PATH || "ffmpeg";
  try {
    return await run(bin, args, { maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    // No system ffmpeg: use the one Remotion ships with.
    return run("npx", ["remotion", "ffmpeg", ...args], { maxBuffer: 64 * 1024 * 1024 });
  }
}

/**
 * Two-pass EBU R128 loudness normalization to YouTube's -14 LUFS target.
 * YouTube turns loud videos down but never turns quiet ones up, so a quiet
 * master just sounds weak next to other videos.
 */
export async function masterAudio(input: string, output: string) {
  log.step("Mastering audio to -14 LUFS");
  const target = "I=-14:TP=-1.0:LRA=11";
  // Audio only, explicit codec: Remotion's bundled ffmpeg has no default video encoder for the null muxer.
  const { stderr } = await ffmpeg(["-hide_banner", "-i", input, "-vn", "-af", `loudnorm=${target}:print_format=json`, "-c:a", "pcm_s16le", "-f", "null", "-"]);
  const json = stderr.slice(stderr.lastIndexOf("{"), stderr.lastIndexOf("}") + 1);
  let filter: string | null = `loudnorm=${target}`;
  try {
    const m = JSON.parse(json) as Record<string, string>;
    if (!Number.isFinite(Number(m.input_i))) {
      // Silent track (mock build): nothing to normalize.
      log.dim("audio is silent; skipping loudness normalization");
      filter = null;
    } else {
      filter += `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
      log.dim(`measured ${m.input_i} LUFS, true peak ${m.input_tp} dBTP`);
    }
  } catch {
    log.warn("loudness measurement failed; using single-pass normalization");
  }
  const tmp = `${output}.tmp.mp4`;
  const audio = filter ? ["-af", filter, "-ar", "48000", "-c:a", "aac", "-b:a", "320k"] : ["-c:a", "copy"];
  await ffmpeg(["-hide_banner", "-y", "-i", input, "-c:v", "copy", ...audio, "-movflags", "+faststart", tmp]);
  await rename(tmp, output);
  log.ok(path.relative(process.cwd(), output));
}

export async function writeCaptionFiles(timeline: Timeline, outDir: string) {
  const fps = timeline.meta.fps;
  const ms = timeline.captions.words.map((w) => ({ text: w.text, start: (w.start / fps) * 1000, end: (w.end / fps) * 1000 }));
  await ensureDir(outDir);
  const srt = path.join(outDir, "captions.srt");
  await writeFile(srt, toSRT(ms));
  await writeFile(path.join(outDir, "captions.vtt"), toVTT(ms));
  return srt;
}

export type ChapterCheck = { ok: boolean; reason?: string; lines: string[] };

/** YouTube only shows chapters if: first at 0:00, at least 3, each at least 10 seconds. */
export function youtubeChapters(timeline: Timeline): ChapterCheck {
  const fps = timeline.meta.fps;
  const ch = timeline.chapters;
  const lines = ch.map((c) => `${chapterStamp(c.startFrame / fps)} ${c.title}`);
  if (ch.length === 0) return { ok: false, reason: "no chapters defined", lines };
  if (ch.length < 3) return { ok: false, reason: "YouTube needs at least 3 chapters", lines };
  for (let i = 0; i < ch.length; i++) {
    const end = ch[i + 1]?.startFrame ?? timeline.meta.durationInFrames;
    if ((end - ch[i].startFrame) / fps < 10) return { ok: false, reason: `chapter "${ch[i].title}" is shorter than 10s`, lines };
  }
  return { ok: true, lines };
}

export function containsSyntheticMedia(spec: VideoSpecT, manifest: Manifest | null) {
  const v = spec.youtube.containsSyntheticMedia;
  if (v !== "auto") return v;
  return manifest ? manifest.usesAIVideo : spec.scenes.some((s) => s.visual?.source === "ai-video");
}

export type YouTubeMetadata = {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: "private" | "unlisted" | "public";
  madeForKids: boolean;
  containsSyntheticMedia: boolean;
  defaultLanguage: string;
  playlistId?: string;
};

export async function writeYouTubeMetadata(spec: VideoSpecT, timeline: Timeline, manifest: Manifest | null, outDir: string) {
  const chapters = youtubeChapters(timeline);
  const credits = [...new Set((manifest?.entries ?? []).map((e) => e.credit).filter(Boolean))];
  const parts = [
    (spec.youtube.description ?? spec.title).trim(),
    chapters.ok ? `Chapters\n${chapters.lines.join("\n")}` : "",
    credits.length ? `Credits\n${credits.join("\n")}` : "",
  ].filter(Boolean);
  const meta: YouTubeMetadata = {
    title: (spec.youtube.title ?? spec.title).slice(0, 100),
    description: parts.join("\n\n").slice(0, 5000),
    tags: spec.youtube.tags,
    categoryId: spec.youtube.categoryId,
    privacyStatus: spec.youtube.privacy,
    madeForKids: spec.youtube.madeForKids,
    containsSyntheticMedia: containsSyntheticMedia(spec, manifest),
    defaultLanguage: spec.youtube.language,
    playlistId: spec.youtube.playlistId,
  };
  await writeJSON(path.join(outDir, "youtube.json"), meta);
  const md = [
    `# ${meta.title}`,
    "",
    `Privacy: ${meta.privacyStatus} · Category: ${meta.categoryId} · Made for kids: ${meta.madeForKids} · Altered/synthetic: ${meta.containsSyntheticMedia}`,
    "",
    "## Description",
    "",
    meta.description,
    "",
    "## Tags",
    "",
    meta.tags.join(", ") || "(none)",
    "",
    chapters.ok ? "" : `> Chapters won't show on YouTube: ${chapters.reason}.`,
  ].join("\n");
  await writeFile(path.join(outDir, "youtube.md"), md);
  return { meta, chapters };
}

export async function cleanTmp(buildDir: string) {
  await rm(path.join(buildDir, "tmp"), { recursive: true, force: true });
}
