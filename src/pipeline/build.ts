import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Timeline } from "../timeline/types";
import { ensureDir, writeJSON } from "../util/fsx";
import { color, log } from "../util/log";
import { buildMusic, buildVisuals, buildVoice, publishUserFile, type BuildContext } from "./assets";
import { lintSpec } from "./lint";
import { Manifest } from "./manifest";
import { vendorFonts } from "./fonts";
import { cleanTmp, masterAudio, writeCaptionFiles, writeYouTubeMetadata } from "./post";
import { loadProject, RENDER_PRESETS, type Project } from "./project";
import { bundleFor, renderThumbnail, renderVideo } from "./render";
import { buildTimeline } from "./timeline";

export type BuildOptions = {
  /** No paid APIs: silent narration with estimated timing, placeholder art, no music. */
  mock?: boolean;
  preset?: string;
  /** Override format.aspect (e.g. cut a 9:16 version of a 16:9 script). */
  aspect?: "16:9" | "9:16" | "1:1";
  /** Stop after assets + timeline (no render). */
  assetsOnly?: boolean;
  /** Render only these scenes (1-based, inclusive) for quick checks. */
  scenes?: [number, number];
  skipMaster?: boolean;
};

export type BuildResult = {
  project: Project;
  timeline: Timeline;
  manifest: Manifest;
  outputs: Record<string, string>;
};

export async function prepare(target: string, opts: BuildOptions = {}): Promise<Omit<BuildResult, "outputs">> {
  const project = await loadProject(target);
  if (opts.aspect) project.spec.format.aspect = opts.aspect;
  for (const w of project.issues.filter((i) => i.level === "warning")) log.warn(`${w.where}: ${w.message}`);

  const lint = lintSpec(project.spec);
  log.step(`${project.spec.title}  ${color.dim(`(${project.spec.scenes.length} scenes, ~${(lint.estimatedSeconds / 60).toFixed(1)} min, ${project.spec.format.aspect})`)}`);

  const manifest = new Manifest();
  const ctx: BuildContext = { project, mock: Boolean(opts.mock), manifest };
  await ensureDir(project.paths.public);

  const voices = await buildVoice(ctx);
  const visuals = await buildVisuals(ctx, voices);
  const logo = project.spec.style.logo ? await publishUserFile(ctx, project.spec.style.logo) : null;
  const sfxFiles = await Promise.all(project.spec.scenes.map((s) => Promise.all(s.sfx.map((fx) => publishUserFile(ctx, fx.file)))));

  const fonts = await vendorFonts(project.theme, project.paths.public);
  const base = { spec: project.spec, theme: project.theme, slug: project.slug, voices, visuals, logo, sfxFiles, fonts };
  let timeline = buildTimeline({ ...base, music: null });
  const music = await buildMusic(ctx, timeline.meta.durationInFrames / timeline.meta.fps);
  if (music) timeline = buildTimeline({ ...base, music });

  await writeJSON(project.paths.timeline, timeline);
  await writeJSON(project.paths.manifest, manifest.toJSON());
  await cleanTmp(project.paths.build);
  log.ok(`timeline ${(timeline.meta.durationInFrames / timeline.meta.fps).toFixed(1)}s, ${timeline.scenes.length} scenes`);
  log.info(`API spend this run: $${manifest.spentUsd.toFixed(2)}  (cache saved $${manifest.savedByCacheUsd.toFixed(2)})`);
  return { project, timeline, manifest };
}

export async function build(target: string, opts: BuildOptions = {}): Promise<BuildResult> {
  const { project, timeline, manifest } = await prepare(target, opts);
  const outputs: Record<string, string> = { timeline: project.paths.timeline, manifest: project.paths.manifest };
  if (opts.assetsOnly) return { project, timeline, manifest, outputs };

  const preset = RENDER_PRESETS[opts.preset ?? "final"];
  if (!preset) throw new Error(`Unknown preset "${opts.preset}". Use: ${Object.keys(RENDER_PRESETS).join(", ")}`);
  const out = await ensureDir(project.paths.out);
  const serveUrl = await bundleFor(project.paths.public);

  let frameRange: [number, number] | undefined;
  if (opts.scenes) {
    const [a, b] = opts.scenes;
    const first = timeline.scenes[a - 1];
    const last = timeline.scenes[Math.min(b, timeline.scenes.length) - 1];
    if (!first || !last) throw new Error(`Scene range ${a}-${b} is out of bounds (1-${timeline.scenes.length})`);
    frameRange = [first.startFrame, last.startFrame + last.durationInFrames - 1];
  }

  const suffix = opts.scenes ? `-scenes-${opts.scenes[0]}-${opts.scenes[1]}` : "";
  const raw = path.join(out, `render${suffix}.mp4`);
  await renderVideo({ serveUrl, timeline, preset, outFile: raw, frameRange });
  outputs.raw = raw;

  const final = path.join(out, `${project.slug}${suffix}${preset.name === "final" ? "" : `-${preset.name}`}.mp4`);
  if (opts.skipMaster) {
    outputs.video = raw;
  } else {
    await masterAudio(raw, final);
    await rm(raw, { force: true });
    delete outputs.raw;
    outputs.video = final;
  }

  if (!opts.scenes) {
    log.step("Thumbnail, captions, YouTube metadata");
    outputs.thumbnail = path.join(out, "thumbnail.png");
    await renderThumbnail(serveUrl, timeline, outputs.thumbnail);
    outputs.captions = await writeCaptionFiles(timeline, out);
    log.ok(path.relative(process.cwd(), outputs.captions));
    const { chapters } = await writeYouTubeMetadata(project.spec, timeline, manifest, out);
    outputs.youtube = path.join(out, "youtube.json");
    log.ok(path.relative(process.cwd(), outputs.youtube));
    if (!chapters.ok && timeline.chapters.length) log.warn(`Chapters won't show on YouTube: ${chapters.reason}`);
    await writeReport(project, timeline, manifest, outputs);
  }
  return { project, timeline, manifest, outputs };
}

async function writeReport(project: Project, timeline: Timeline, manifest: Manifest, outputs: Record<string, string>) {
  const fps = timeline.meta.fps;
  const lint = lintSpec(project.spec);
  const rows = timeline.scenes.map(
    (s) => `| ${s.index + 1} | ${s.type} | ${(s.startFrame / fps).toFixed(1)}s | ${(s.durationInFrames / fps).toFixed(1)}s | ${s.visual?.kind ?? "-"} | ${s.chapter ?? ""} |`,
  );
  const md = [
    `# Build report: ${project.spec.title}`,
    "",
    `Duration ${(timeline.meta.durationInFrames / fps).toFixed(1)}s · ${timeline.scenes.length} scenes · ${timeline.meta.width}x${timeline.meta.height} base`,
    `API spend this run $${manifest.spentUsd.toFixed(2)} · saved by cache $${manifest.savedByCacheUsd.toFixed(2)}`,
    "",
    "| # | type | start | length | visual | chapter |",
    "|---|------|-------|--------|--------|---------|",
    ...rows,
    "",
    "## Editorial checks",
    "",
    ...(lint.issues.length ? lint.issues.map((i) => `- **${i.level}** ${i.where}: ${i.message}`) : ["Nothing flagged."]),
    "",
    "## Outputs",
    "",
    ...Object.entries(outputs).map(([k, v]) => `- ${k}: \`${path.relative(project.dir, v)}\``),
    "",
  ].join("\n");
  const file = path.join(project.paths.out, "report.md");
  await writeFile(file, md);
  outputs.report = file;
}
