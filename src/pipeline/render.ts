import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Timeline } from "../timeline/types";
import { ensureDir } from "../util/fsx";
import { log } from "../util/log";
import type { RenderPreset } from "./project";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const REMOTION_ENTRY = path.join(repoRoot, "src/remotion/index.ts");

function browserOptions() {
  const exe = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const logLevel = process.env.VF_VERBOSE ? ("verbose" as const) : ("error" as const);
  return { browserExecutable: exe, chromeMode: "headless-shell" as const, logLevel };
}

function licenseOptions() {
  return process.env.REMOTION_LICENSE_KEY ? { licenseKey: process.env.REMOTION_LICENSE_KEY } : {};
}

/** Bundle the Remotion project with this video's assets as its public dir. */
export async function bundleFor(publicDir: string): Promise<string> {
  log.step("Bundling compositions");
  let last = -1;
  const url = await bundle({
    entryPoint: REMOTION_ENTRY,
    publicDir,
    onProgress: (p) => {
      if (p >= last + 25 || p === 100) {
        last = p;
        log.dim(`bundle ${p}%`);
      }
    },
  });
  return url;
}

export type RenderOptions = {
  serveUrl: string;
  timeline: Timeline;
  preset: RenderPreset;
  outFile: string;
  frameRange?: [number, number];
};

export async function renderVideo(o: RenderOptions) {
  const inputProps = { timeline: o.timeline };
  const composition = await selectComposition({
    serveUrl: o.serveUrl,
    id: "Video",
    inputProps,
    ...browserOptions(),
  });
  const w = Math.round(composition.width * o.preset.scale);
  const h = Math.round(composition.height * o.preset.scale);
  log.step(`Rendering ${w}x${h} @ ${composition.fps}fps, ${(composition.durationInFrames / composition.fps).toFixed(1)}s (${o.preset.name})`);
  await ensureDir(path.dirname(o.outFile));
  const started = Date.now();
  let lastPct = -1;
  await renderMedia({
    composition,
    serveUrl: o.serveUrl,
    codec: "h264",
    outputLocation: o.outFile,
    inputProps,
    scale: o.preset.scale,
    crf: o.preset.crf,
    x264Preset: o.preset.x264Preset,
    imageFormat: "jpeg",
    jpegQuality: o.preset.jpegQuality,
    pixelFormat: "yuv420p",
    colorSpace: "bt709",
    audioCodec: "aac",
    audioBitrate: o.preset.audioBitrate,
    concurrency: Number(process.env.REMOTION_CONCURRENCY) || Math.max(1, Math.floor(os.cpus().length / 2)),
    frameRange: o.frameRange ?? null,
    timeoutInMilliseconds: 120_000,
    ...browserOptions(),
    ...licenseOptions(),
    onProgress: ({ progress, renderedFrames, encodedFrames }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= lastPct + 10) {
        lastPct = pct;
        log.dim(`render ${pct}%  (${renderedFrames} rendered, ${encodedFrames} encoded)`);
      }
    },
  });
  log.ok(`${path.relative(process.cwd(), o.outFile)}  in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

export async function renderThumbnail(serveUrl: string, timeline: Timeline, outFile: string) {
  const inputProps = { timeline };
  const composition = await selectComposition({ serveUrl, id: "Thumbnail", inputProps, ...browserOptions() });
  await renderStill({
    composition,
    serveUrl,
    output: outFile,
    inputProps,
    imageFormat: "png",
    ...browserOptions(),
    ...licenseOptions(),
  });
  log.ok(path.relative(process.cwd(), outFile));
}
