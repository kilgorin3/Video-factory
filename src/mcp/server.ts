/**
 * Video Factory as an MCP server. Lets Claude (Desktop, Code, or any MCP client)
 * drive the whole pipeline in conversation: scaffold, plan, edit, check, build, publish.
 *
 *   claude mcp add video-factory -- npx tsx /path/to/video-factory/src/mcp/server.ts
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYAML } from "yaml";
import { z } from "zod";
import { build } from "../pipeline/build";
import { estimateCost } from "../pipeline/estimate";
import { lintSpec } from "../pipeline/lint";
import { loadProject } from "../pipeline/project";
import { checkSpec, parseSpec } from "../spec/load";
import { SCENE_TYPES } from "../spec/schema";
import { THEMES } from "../spec/themes";
import { ensureDir, exists } from "../util/fsx";
import { setLogSink } from "../util/log";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(repoRoot);
try {
  process.loadEnvFile(".env");
} catch {
  /* optional */
}

// stdout carries JSON-RPC. Everything else (our logs, Remotion, ffmpeg) must go to stderr.
const logs: string[] = [];
setLogSink((line) => {
  logs.push(line.replace(/\x1b\[[0-9;]*m/g, ""));
  process.stderr.write(`${line}\n`);
});
console.log = (...a: unknown[]) => process.stderr.write(`${a.join(" ")}\n`);
console.info = console.log;

const PROJECTS = path.join(repoRoot, "projects");
const projectDir = (name: string) => {
  const dir = path.resolve(PROJECTS, name);
  if (!dir.startsWith(PROJECTS + path.sep)) throw new Error("Project must live under projects/");
  return dir;
};

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
async function run(fn: () => Promise<string>) {
  logs.length = 0;
  try {
    return text(await fn());
  } catch (e) {
    const tail = logs.slice(-15).join("\n");
    return { ...text(`Error: ${(e as Error).message}${tail ? `\n\nLog:\n${tail}` : ""}`), isError: true };
  }
}

const server = new McpServer({ name: "video-factory", version: "0.1.0" });

server.registerTool(
  "list_projects",
  { title: "List video projects", description: "List projects under projects/ with title, scene count and build status.", inputSchema: {} },
  () =>
    run(async () => {
      const names = (await readdir(PROJECTS, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
      const rows = await Promise.all(
        names.map(async (n) => {
          const file = path.join(PROJECTS, n, "video.yaml");
          if (!exists(file)) return `${n}: (no video.yaml)`;
          const spec = parseYAML(await readFile(file, "utf8")) as { title?: string; scenes?: unknown[] };
          const built = exists(path.join(PROJECTS, n, "build", "out", "youtube.json"));
          return `${n}: "${spec.title}" · ${spec.scenes?.length ?? 0} scenes · ${built ? "built" : "not built"}`;
        }),
      );
      return rows.join("\n") || "No projects yet.";
    }),
);

server.registerTool(
  "create_project",
  {
    title: "Create a project",
    description: "Scaffold projects/<name> with a starter video.yaml and a brief.md. Pass the brief text to fill brief.md (topic, audience, key points, tone, length).",
    inputSchema: {
      name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).describe("folder name, e.g. black-holes-101"),
      title: z.string(),
      theme: z.string().default("midnight").describe(`one of: ${Object.keys(THEMES).join(", ")}`),
      brief: z.string().optional().describe("markdown brief to save as brief.md"),
      script: z.string().optional().describe("finished narration script to save as script.md (planner keeps its wording)"),
    },
  },
  ({ name, title, theme, brief, script }) =>
    run(async () => {
      const dir = projectDir(name);
      if (exists(path.join(dir, "video.yaml"))) throw new Error(`projects/${name} already exists`);
      await ensureDir(path.join(dir, "assets"));
      const template = await readFile(path.join(repoRoot, "templates", "video.yaml"), "utf8");
      await writeFile(path.join(dir, "video.yaml"), template.replace("__TITLE__", title).replace("__TITLE__", title).replace("__THEME__", theme));
      if (brief) await writeFile(path.join(dir, "brief.md"), brief);
      if (script) await writeFile(path.join(dir, "script.md"), script);
      return `Created projects/${name}. Next: plan_video (needs brief or script), or edit the spec with update_spec.`;
    }),
);

server.registerTool(
  "plan_video",
  {
    title: "Storyboard with Claude",
    description: "Turn the project's brief.md or script.md into a full scene-by-scene video.yaml (narration, cues, templates, visual prompts, YouTube metadata). Replaces existing scenes when force is true.",
    inputSchema: { name: z.string(), minutes: z.number().positive().optional(), force: z.boolean().default(false) },
  },
  ({ name, minutes, force }) =>
    run(async () => {
      const { planProject } = await import("../planner/plan");
      await planProject(projectDir(name), { minutes, force });
      return `${logs.join("\n")}\n\n${await readFile(path.join(projectDir(name), "video.yaml"), "utf8")}`;
    }),
);

server.registerTool(
  "get_spec",
  { title: "Read video.yaml", description: "Return the project's video.yaml.", inputSchema: { name: z.string() } },
  ({ name }) => run(async () => readFile(path.join(projectDir(name), "video.yaml"), "utf8")),
);

server.registerTool(
  "update_spec",
  {
    title: "Replace video.yaml",
    description: "Validate and save a full new video.yaml (previous version kept as video.yaml.bak). Rejects invalid specs with the exact errors.",
    inputSchema: { name: z.string(), yaml: z.string() },
  },
  ({ name, yaml }) =>
    run(async () => {
      const dir = projectDir(name);
      const spec = parseSpec(parseYAML(yaml));
      const errors = checkSpec(spec, dir).filter((i) => i.level === "error");
      if (errors.length) throw new Error(errors.map((e) => `${e.where}: ${e.message}`).join("\n"));
      const file = path.join(dir, "video.yaml");
      if (exists(file)) await copyFile(file, `${file}.bak`);
      await writeFile(file, yaml);
      const lint = lintSpec(spec);
      return `Saved (${spec.scenes.length} scenes, ~${(lint.estimatedSeconds / 60).toFixed(1)} min).`;
    }),
);

server.registerTool(
  "check_video",
  {
    title: "Validate, lint and estimate",
    description: "Schema/reference errors, editorial lint (hook, pacing, monotony, pronunciation, contrast) and the API cost estimate.",
    inputSchema: { name: z.string() },
  },
  ({ name }) =>
    run(async () => {
      const p = await loadProject(projectDir(name), { strict: false });
      const lint = lintSpec(p.spec);
      const cost = estimateCost(p.spec);
      const issues = [...p.issues, ...lint.issues].map((i) => `[${i.level}] ${i.where}: ${i.message}`);
      return [
        `${p.spec.title}: ${p.spec.scenes.length} scenes, ${lint.words} words, ~${(lint.estimatedSeconds / 60).toFixed(1)} min`,
        "",
        issues.length ? issues.join("\n") : "No issues.",
        "",
        "Estimated cost (uncached):",
        ...cost.lines.map((l) => `  ${l.item}: ${l.quantity} = $${l.usd.toFixed(2)}`),
        `  Total: $${cost.totalUsd.toFixed(2)}`,
      ].join("\n");
    }),
);

server.registerTool(
  "review_facts",
  {
    title: "Fact-check narration",
    description: "Claude with web search checks every factual claim and stat; writes build/review.md and returns it.",
    inputSchema: { name: z.string() },
  },
  ({ name }) =>
    run(async () => {
      const { reviewProject } = await import("../planner/review");
      await reviewProject(projectDir(name));
      return readFile(path.join(projectDir(name), "build", "review.md"), "utf8");
    }),
);

server.registerTool(
  "build_video",
  {
    title: "Build and render",
    description:
      "Generate voice, visuals and music, render with Remotion, master audio, and write thumbnail, captions and YouTube metadata. mock=true uses no paid APIs. Takes minutes. Spends API credits unless mock.",
    inputSchema: {
      name: z.string(),
      mock: z.boolean().default(false),
      preset: z.enum(["draft", "final", "1440p", "4k"]).default("draft"),
      aspect: z.enum(["16:9", "9:16", "1:1"]).optional(),
      scenes: z.string().regex(/^\d+(-\d+)?$/).optional().describe("render only scenes a-b, e.g. 3-5"),
    },
  },
  ({ name, mock, preset, aspect, scenes }) =>
    run(async () => {
      const parts = scenes?.split("-").map(Number);
      const r = await build(projectDir(name), {
        mock,
        preset,
        aspect,
        scenes: parts ? [parts[0], parts[1] ?? parts[0]] : undefined,
      });
      return [
        `Rendered ${(r.timeline.meta.durationInFrames / r.timeline.meta.fps).toFixed(1)}s. API spend $${r.manifest.spentUsd.toFixed(2)}.`,
        ...Object.entries(r.outputs).map(([k, v]) => `${k}: ${path.relative(repoRoot, v)}`),
      ].join("\n");
    }),
);

server.registerTool(
  "publish_youtube",
  {
    title: "Upload to YouTube",
    description:
      "Upload the built video with thumbnail, captions and metadata. Publicly visible if privacy is public, so confirm with the user first. Defaults to the spec's privacy (private).",
    inputSchema: { name: z.string(), privacy: z.enum(["private", "unlisted", "public"]).optional() },
  },
  ({ name, privacy }) =>
    run(async () => {
      const { publishProject } = await import("../publish/youtube");
      const r = await publishProject(projectDir(name), { privacy });
      return `Uploaded: ${r.url}`;
    }),
);

server.registerTool(
  "list_options",
  { title: "Themes and templates", description: "List theme presets and scene templates.", inputSchema: {} },
  () =>
    run(async () =>
      [
        "Themes:",
        ...Object.values(THEMES).map((t) => `  ${t.name} (${t.dark ? "dark" : "light"}, ${t.fonts.heading}/${t.fonts.body}) primary ${t.colors.primary} accent ${t.colors.accent}`),
        "",
        `Scene templates: ${SCENE_TYPES.join(", ")}`,
        "Reference: docs/SPEC.md",
      ].join("\n"),
    ),
);

await server.connect(new StdioServerTransport());
process.stderr.write("video-factory MCP server ready\n");
