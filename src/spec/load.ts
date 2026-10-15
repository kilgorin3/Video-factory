import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYAML } from "yaml";
import { z } from "zod";
import { exists, slugify } from "../util/fsx";
import { cueNames } from "../text/narration";
import { VideoSpec, type SceneSpec, type VideoSpecT } from "./schema";
import { resolveTheme } from "./themes";

export type Issue = { level: "error" | "warning"; where: string; message: string };

export class SpecError extends Error {
  constructor(
    message: string,
    public issues: Issue[] = [],
  ) {
    super(message);
  }
}

export function specPathFor(target: string): string {
  if (target.endsWith(".yaml") || target.endsWith(".yml") || target.endsWith(".json")) return target;
  return path.join(target, "video.yaml");
}

export async function readSpecFile(file: string): Promise<VideoSpecT> {
  if (!exists(file)) throw new SpecError(`No spec found at ${file}. Run "vf init" or "vf plan" first.`);
  const raw = await readFile(file, "utf8");
  const data = file.endsWith(".json") ? JSON.parse(raw) : parseYAML(raw);
  return parseSpec(data);
}

export function parseSpec(data: unknown): VideoSpecT {
  const result = VideoSpec.safeParse(data);
  if (!result.success) {
    throw new SpecError(`video.yaml is invalid:\n${z.prettifyError(result.error)}`, [
      ...result.error.issues.map((i) => ({
        level: "error" as const,
        where: i.path.join("."),
        message: i.message,
      })),
    ]);
  }
  const spec = result.data;
  spec.slug ??= slugify(spec.title);
  return spec;
}

export const sceneLabel = (s: SceneSpec, i: number) => `scenes[${i}] (${s.id ?? s.type})`;

/** Cross-field checks zod can't express: cue references, files, prompts. */
export function checkSpec(spec: VideoSpecT, projectDir: string): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ level: "error", where, message });
  const warn = (where: string, message: string) => issues.push({ level: "warning", where, message });

  try {
    resolveTheme(spec.style);
  } catch (e) {
    err("style.theme", (e as Error).message);
  }

  const ids = new Set<string>();
  spec.scenes.forEach((s, i) => {
    const where = sceneLabel(s, i);
    if (s.id) {
      if (ids.has(s.id)) err(where, `Duplicate scene id "${s.id}"`);
      ids.add(s.id);
    }

    const cues = new Set(cueNames(s.narration));
    for (const ref of referencedCues(s)) {
      if (!cues.has(ref)) err(where, `Cue "${ref}" is used but narration has no [[${ref}]] marker`);
    }

    if (!s.narration.trim() && !s.duration) {
      warn(where, "Silent scene without duration; defaulting to 3 seconds");
    }

    const needsVisual = s.type === "image" || s.type === "video" || s.type === "split";
    const v = s.visual;
    if (needsVisual && (!v || v.source === "none")) err(where, `A ${s.type} scene needs a visual`);
    if (s.type === "video" && v && !["ai-video", "stock-video", "file"].includes(v.source)) {
      warn(where, `Video scene uses a still (${v.source}); it will get a Ken Burns move instead of motion`);
    }
    if (v) {
      if ((v.source === "ai-image" || v.source === "ai-video") && !v.prompt) {
        err(`${where}.visual`, `source ${v.source} needs a prompt`);
      }
      if ((v.source === "stock-image" || v.source === "stock-video") && !v.query && !v.prompt) {
        err(`${where}.visual`, `source ${v.source} needs a query`);
      }
      if (v.source === "file") {
        if (!v.file) err(`${where}.visual`, "source file needs a file path");
        else if (!exists(path.resolve(projectDir, v.file))) err(`${where}.visual`, `File not found: ${v.file}`);
      }
      if (v.prompt && /\b(text|words|label|caption|title|letters)\s+(saying|that says|reading)\b/i.test(v.prompt)) {
        warn(`${where}.visual`, "Prompt asks for text inside the image. Put text in the scene instead; generators misspell it.");
      }
    }
    for (const sfx of s.sfx) {
      if (!exists(path.resolve(projectDir, sfx.file))) err(`${where}.sfx`, `File not found: ${sfx.file}`);
      if (typeof sfx.at === "string" && !cues.has(sfx.at)) err(`${where}.sfx`, `Unknown cue "${sfx.at}"`);
    }
  });

  if (spec.style.logo && !exists(path.resolve(projectDir, spec.style.logo))) {
    err("style.logo", `File not found: ${spec.style.logo}`);
  }
  if (spec.music.source === "file") {
    if (!spec.music.file) err("music.file", "music.source is file but no file given");
    else if (!exists(path.resolve(projectDir, spec.music.file))) err("music.file", `File not found: ${spec.music.file}`);
  }
  if (spec.music.source === "elevenlabs" && !spec.music.prompt) {
    err("music.prompt", "music.source is elevenlabs but no prompt given");
  }
  if (spec.voice.provider === "command" && !spec.voice.command) {
    err("voice.command", "voice.provider is command but no command template given");
  }
  return issues;
}

/** Every cue name a scene's fields refer to. */
export function referencedCues(s: SceneSpec): string[] {
  const out: (string | undefined)[] = [];
  switch (s.type) {
    case "bullets":
    case "split":
      out.push(...s.points.map((p) => p.cue));
      break;
    case "comparison":
      out.push(...s.left.points.map((p) => p.cue), ...s.right.points.map((p) => p.cue));
      break;
    case "chart":
      out.push(...s.data.map((d) => d.cue));
      break;
    case "steps":
      out.push(...s.steps.map((d) => d.cue));
      break;
    case "timeline":
      out.push(...s.events.map((d) => d.cue));
      break;
    case "code":
      out.push(...s.highlights.map((d) => d.cue));
      break;
  }
  return out.filter((x): x is string => Boolean(x));
}
