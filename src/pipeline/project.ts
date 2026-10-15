import path from "node:path";
import { checkSpec, readSpecFile, specPathFor, SpecError, type Issue } from "../spec/load";
import type { VideoSpecT } from "../spec/schema";
import { resolveTheme } from "../spec/themes";
import type { Theme } from "../timeline/types";

export type Project = {
  dir: string;
  specPath: string;
  spec: VideoSpecT;
  theme: Theme;
  slug: string;
  issues: Issue[];
  paths: {
    build: string;
    /** Remotion publicDir. Everything the render reads lives here. */
    public: string;
    out: string;
    timeline: string;
    manifest: string;
  };
};

export function projectPaths(dir: string) {
  const build = path.join(dir, "build");
  const pub = path.join(build, "public");
  return {
    build,
    public: pub,
    out: path.join(build, "out"),
    timeline: path.join(build, "timeline.json"),
    manifest: path.join(build, "manifest.json"),
  };
}

export async function loadProject(target: string, opts: { strict?: boolean } = {}): Promise<Project> {
  const specPath = path.resolve(specPathFor(target));
  const dir = path.dirname(specPath);
  const spec = await readSpecFile(specPath);
  const issues = checkSpec(spec, dir);
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length && opts.strict !== false) {
    throw new SpecError(
      `video.yaml has ${errors.length} problem(s):\n${errors.map((e) => `  ${e.where}: ${e.message}`).join("\n")}`,
      issues,
    );
  }
  return {
    dir,
    specPath,
    spec,
    theme: resolveTheme(spec.style),
    slug: spec.slug!,
    issues,
    paths: projectPaths(dir),
  };
}

export const BASE_SIZES = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
} as const;

export type RenderPreset = {
  name: string;
  /** Multiplier on the 1080p composition (0.5 = 540p, 2 = 4K). */
  scale: number;
  crf: number;
  x264Preset: "veryfast" | "fast" | "medium" | "slow";
  jpegQuality: number;
  audioBitrate: `${number}k`;
};

export const RENDER_PRESETS: Record<string, RenderPreset> = {
  draft: { name: "draft", scale: 0.5, crf: 28, x264Preset: "veryfast", jpegQuality: 80, audioBitrate: "128k" },
  final: { name: "final", scale: 1, crf: 17, x264Preset: "medium", jpegQuality: 95, audioBitrate: "320k" },
  "1440p": { name: "1440p", scale: 4 / 3, crf: 17, x264Preset: "medium", jpegQuality: 95, audioBitrate: "320k" },
  "4k": { name: "4k", scale: 2, crf: 16, x264Preset: "medium", jpegQuality: 95, audioBitrate: "320k" },
};
