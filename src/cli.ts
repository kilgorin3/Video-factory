import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { build, prepare } from "./pipeline/build";
import { estimateCost } from "./pipeline/estimate";
import { lintSpec } from "./pipeline/lint";
import { loadProject, RENDER_PRESETS } from "./pipeline/project";
import { bundleFor, REMOTION_ENTRY, renderThumbnail } from "./pipeline/render";
import { SpecError } from "./spec/load";
import { SCENE_TYPES } from "./spec/schema";
import { THEMES } from "./spec/themes";
import { ensureDir, exists } from "./util/fsx";
import { color, log } from "./util/log";

try {
  process.loadEnvFile(".env");
} catch {
  /* no .env is fine */
}

const program = new Command()
  .name("vf")
  .description("Video Factory: script in, YouTube-ready educational video out.")
  .showHelpAfterError();

program
  .command("init")
  .argument("<dir>", "new project folder, e.g. projects/my-video")
  .option("--title <title>", "working title", "Untitled video")
  .option("--theme <name>", "theme preset", "midnight")
  .description("Scaffold a project with a starter video.yaml")
  .action(async (dir: string, o: { title: string; theme: string }) => {
    const file = path.join(dir, "video.yaml");
    if (exists(file)) throw new Error(`${file} already exists`);
    await ensureDir(path.join(dir, "assets"));
    const template = await readFile(new URL("../templates/video.yaml", import.meta.url), "utf8");
    await writeFile(file, template.replace("__TITLE__", o.title).replace("__THEME__", o.theme));
    await writeFile(path.join(dir, "brief.md"), BRIEF_TEMPLATE.replace("__TITLE__", o.title));
    log.ok(`Created ${file} and brief.md`);
    log.info(`Next: write brief.md (or a full script.md), then  ${color.cyan(`vf plan ${dir}`)}`);
  });

program
  .command("plan")
  .argument("<dir>", "project folder")
  .option("--brief <file>", "brief/outline to storyboard (default: brief.md)")
  .option("--script <file>", "finished script to storyboard verbatim (default: script.md if present)")
  .option("--minutes <n>", "target length", parseFloat)
  .option("--force", "overwrite an existing video.yaml with scenes")
  .description("Use Claude to turn a brief or script into a full scene-by-scene video.yaml")
  .action(async (dir: string, o: { brief?: string; script?: string; minutes?: number; force?: boolean }) => {
    const { planProject } = await import("./planner/plan");
    await planProject(dir, o);
  });

program
  .command("validate")
  .argument("<dir>", "project folder or video.yaml")
  .description("Check video.yaml for schema and reference errors")
  .action(async (dir: string) => {
    const p = await loadProject(dir, { strict: false });
    const errors = p.issues.filter((i) => i.level === "error");
    for (const i of p.issues) (i.level === "error" ? log.error : log.warn)(`${i.where}: ${i.message}`);
    if (errors.length) process.exitCode = 1;
    else log.ok(`${p.specPath} is valid (${p.spec.scenes.length} scenes)`);
  });

program
  .command("lint")
  .argument("<dir>", "project folder")
  .description("Editorial checks: hook speed, pacing, monotony, pronunciation, contrast")
  .action(async (dir: string) => {
    const p = await loadProject(dir, { strict: false });
    const r = lintSpec(p.spec);
    log.step(`${r.words} words, ~${(r.estimatedSeconds / 60).toFixed(1)} min at 150 wpm`);
    for (const i of [...p.issues, ...r.issues]) {
      const fn = i.level === "error" ? log.error : i.level === "warning" ? log.warn : log.dim;
      fn(`${i.where}: ${i.message}`);
    }
    if (!r.issues.length && !p.issues.length) log.ok("Nothing flagged");
  });

program
  .command("review")
  .argument("<dir>", "project folder")
  .description("Claude fact-checks the narration and flags claims that need a source")
  .action(async (dir: string) => {
    const { reviewProject } = await import("./planner/review");
    await reviewProject(dir);
  });

program
  .command("estimate")
  .argument("<dir>", "project folder")
  .description("Estimate API cost of a full uncached build")
  .action(async (dir: string) => {
    const p = await loadProject(dir, { strict: false });
    const e = estimateCost(p.spec);
    log.step(`Estimated cost for ~${e.minutes.toFixed(1)} min`);
    for (const l of e.lines) log.info(`${l.item.padEnd(48)} ${l.quantity.padEnd(22)} $${l.usd.toFixed(2)}`);
    log.info(color.bold(`${"Total".padEnd(71)} $${e.totalUsd.toFixed(2)}`));
    log.dim("Re-builds reuse cached assets; you only pay again for scenes you change.");
  });

program
  .command("assets")
  .argument("<dir>", "project folder")
  .option("--mock", "no paid APIs")
  .option("--aspect <ratio>", "16:9 | 9:16 | 1:1")
  .description("Generate narration, visuals and music, and write the timeline (no render)")
  .action(async (dir: string, o: { mock?: boolean; aspect?: "16:9" | "9:16" | "1:1" }) => {
    await prepare(dir, o);
  });

program
  .command("build")
  .argument("<dir>", "project folder")
  .option("--mock", "no paid APIs: silent narration, placeholder art, no music")
  .option("--preset <name>", `render preset: ${Object.keys(RENDER_PRESETS).join(" | ")}`, "final")
  .option("--aspect <ratio>", "override aspect: 16:9 | 9:16 | 1:1")
  .option("--scenes <range>", "render only scenes a-b (1-based), e.g. 3-5")
  .option("--no-master", "skip loudness mastering")
  .description("Everything: voice, visuals, music, timeline, render, master, thumbnail, captions, metadata")
  .action(async (dir: string, o: { mock?: boolean; preset: string; aspect?: "16:9" | "9:16" | "1:1"; scenes?: string; master: boolean }) => {
    const parts = o.scenes?.split("-").map(Number);
    const scenes: [number, number] | undefined = parts ? [parts[0], parts[1] ?? parts[0]] : undefined;
    const r = await build(dir, { mock: o.mock, preset: o.preset, aspect: o.aspect, scenes, skipMaster: !o.master });
    log.step("Done");
    for (const [k, v] of Object.entries(r.outputs)) log.info(`${k.padEnd(10)} ${path.relative(process.cwd(), v)}`);
  });

program
  .command("thumbnail")
  .argument("<dir>", "project folder")
  .option("--text <words>", "override thumbnail text (2-5 words)")
  .option("--scene <n>", "use scene n's visual as the background", parseInt)
  .option("--out <file>", "file name inside build/out", "thumbnail.png")
  .option("--mock", "no paid APIs")
  .description("Render only the thumbnail; run it a few times with --text/--scene/--out for A/B variants")
  .action(async (dir: string, o: { text?: string; scene?: number; out: string; mock?: boolean }) => {
    const { timeline, project } = await prepare(dir, { mock: o.mock });
    if (o.text) timeline.thumbnail.title = o.text;
    if (o.scene) {
      const v = timeline.scenes[o.scene - 1]?.visual;
      timeline.thumbnail.image = v?.kind === "image" ? v.src : timeline.thumbnail.image;
    }
    const serveUrl = await bundleFor(project.paths.public);
    const out = path.join(await ensureDir(project.paths.out), o.out);
    await renderThumbnail(serveUrl, timeline, out);
  });

program
  .command("preview")
  .argument("<dir>", "project folder")
  .option("--mock", "build assets with mock providers first")
  .option("--rebuild", "regenerate the timeline before opening")
  .description("Open Remotion Studio on this project to scrub and tweak")
  .action(async (dir: string, o: { mock?: boolean; rebuild?: boolean }) => {
    const p = await loadProject(dir, { strict: false });
    if (o.rebuild || o.mock || !exists(p.paths.timeline)) await prepare(dir, { mock: o.mock });
    const props = path.join(p.paths.build, "studio-props.json");
    await writeFile(props, JSON.stringify({ timeline: JSON.parse(await readFile(p.paths.timeline, "utf8")) }));
    spawn("npx", ["remotion", "studio", REMOTION_ENTRY, `--public-dir=${p.paths.public}`, `--props=${props}`], { stdio: "inherit" });
  });

program
  .command("publish")
  .argument("<dir>", "project folder (must be built)")
  .option("--privacy <status>", "override privacy: private | unlisted | public")
  .option("--force", "upload again even if this build was already published")
  .description("Upload the built video, thumbnail and captions to YouTube")
  .action(async (dir: string, o: { privacy?: "private" | "unlisted" | "public"; force?: boolean }) => {
    const { publishProject } = await import("./publish/youtube");
    await publishProject(dir, o);
  });

program
  .command("youtube-auth")
  .description("One-time OAuth login so vf publish can upload to your channel")
  .action(async () => {
    const { authorize } = await import("./publish/youtube");
    await authorize();
  });

program
  .command("voices")
  .description("List ElevenLabs voices on your account")
  .action(async () => {
    const { listElevenVoices } = await import("./providers/tts/elevenlabs");
    for (const v of await listElevenVoices()) log.info(`${v.id}  ${color.bold(v.name)}  ${color.dim(v.labels)}`);
  });

program
  .command("themes")
  .description("List theme presets")
  .action(() => {
    for (const t of Object.values(THEMES)) {
      log.info(`${color.bold(t.name.padEnd(11))} ${t.dark ? "dark " : "light"}  ${t.fonts.heading} / ${t.fonts.body}  ${Object.values(t.colors).slice(0, 4).join(" ")}`);
    }
  });

program
  .command("templates")
  .description("List scene templates")
  .action(() => log.info(SCENE_TYPES.join(", ")));

const BRIEF_TEMPLATE = `# __TITLE__

## Topic
What is this video about, in one sentence?

## Audience
Who is watching, and what do they already know?

## Promise
What will the viewer be able to do or understand by the end?

## Key points (in order)
1.
2.
3.

## Must include
Facts, examples, analogies, numbers (with sources), or visuals you want.

## Avoid
Anything off-limits: jargon, topics, claims.

## Length and tone
e.g. 6 minutes, warm and a bit playful.
`;

program.parseAsync().catch((e: unknown) => {
  if (e instanceof SpecError) log.error(e.message);
  else log.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exitCode = 1;
});
