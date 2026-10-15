import type Anthropic from "@anthropic-ai/sdk";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYAML, stringify as toYAML } from "yaml";
import { estimateCost } from "../pipeline/estimate";
import { lintSpec } from "../pipeline/lint";
import { checkSpec, parseSpec, SpecError } from "../spec/load";
import type { VideoSpecT } from "../spec/schema";
import { exists } from "../util/fsx";
import { color, log } from "../util/log";
import { claude, explainError, PLANNER_EFFORT, PLANNER_MODEL, textOf } from "./claude";
import { plannerSystemPrompt } from "./prompts";

type PlanOptions = { brief?: string; script?: string; minutes?: number; force?: boolean };

/** Settings the human owns. The planner may propose them only when absent. */
const PRESERVE = ["format", "style", "voice", "music", "providers"] as const;

export async function planProject(dir: string, o: PlanOptions) {
  const specFile = path.join(dir, "video.yaml");
  const existing = exists(specFile) ? (parseYAML(await readFile(specFile, "utf8")) as Record<string, unknown>) : {};
  const scriptFile = o.script ?? (exists(path.join(dir, "script.md")) ? path.join(dir, "script.md") : undefined);
  const briefFile = o.brief ?? (exists(path.join(dir, "brief.md")) ? path.join(dir, "brief.md") : undefined);
  if (!scriptFile && !briefFile) throw new Error(`Write ${path.join(dir, "brief.md")} or script.md first (vf init scaffolds one).`);

  const hasRealScenes = Array.isArray(existing.scenes) && existing.scenes.length > 3;
  if (hasRealScenes && !o.force) {
    throw new Error(`${specFile} already has ${(existing.scenes as unknown[]).length} scenes. Re-run with --force to replace them (a .bak copy is kept).`);
  }

  const source = scriptFile
    ? `## Finished script (keep the wording; split it into scenes, add cues, visuals and templates)\n\n${await readFile(scriptFile, "utf8")}`
    : `## Brief (write the full narration from this)\n\n${await readFile(briefFile!, "utf8")}`;
  const settings = Object.fromEntries(Object.entries(existing).filter(([k]) => k !== "scenes"));
  const minutes = o.minutes ?? (existing.scope as { targetMinutes?: number } | undefined)?.targetMinutes;

  const user = [
    source,
    "## Settings already chosen (keep these exactly)",
    "```yaml",
    toYAML(settings).trim() || "# none yet",
    "```",
    minutes ? `Target length: ${minutes} minutes.` : "",
    "Write the complete video spec now.",
  ].join("\n\n");

  log.step(`Planning with ${PLANNER_MODEL()} (effort ${PLANNER_EFFORT()})`);
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: user }];
  let spec: VideoSpecT | null = null;
  let yamlText = "";

  for (let attempt = 0; attempt < 3 && !spec; attempt++) {
    const response = await call(messages);
    yamlText = extractYAML(textOf(response.content));
    messages.push({ role: "assistant", content: response.content });
    try {
      const data = parseYAML(yamlText) as Record<string, unknown>;
      for (const key of PRESERVE) if (existing[key] !== undefined) data[key] = existing[key];
      const parsed = parseSpec(data);
      const errors = checkSpec(parsed, dir).filter((i) => i.level === "error");
      if (errors.length) throw new SpecError("semantic", errors);
      spec = parsed;
      yamlText = toYAML(data, { lineWidth: 110 });
    } catch (e) {
      const detail =
        e instanceof SpecError && e.issues.length
          ? e.issues.map((i) => `- ${i.where}: ${i.message}`).join("\n")
          : (e as Error).message;
      log.warn(`Draft ${attempt + 1} had problems; asking for a fix`);
      log.dim(detail.split("\n").slice(0, 8).join("\n  "));
      messages.push({
        role: "user",
        content: `The spec failed validation:\n${detail}\n\nReturn the full corrected spec as one yaml block.`,
      });
    }
  }
  if (!spec) throw new Error("Planner could not produce a valid spec after 3 attempts. The last draft was not saved.");

  if (exists(specFile)) await copyFile(specFile, `${specFile}.bak`);
  const header = `# Planned by ${PLANNER_MODEL()} on ${new Date().toISOString().slice(0, 10)}. Review it: this file is the source of truth.\n`;
  await writeFile(specFile, header + yamlText);
  log.ok(`Wrote ${specFile} (${spec.scenes.length} scenes)`);

  const lint = lintSpec(spec);
  const cost = estimateCost(spec);
  log.info(`~${(lint.estimatedSeconds / 60).toFixed(1)} min, estimated build cost $${cost.totalUsd.toFixed(2)}`);
  for (const i of lint.issues.filter((x) => x.level !== "info")) log.warn(`${i.where}: ${i.message}`);
  log.info(`Next: read it, then ${color.cyan(`vf review ${dir}`)} and ${color.cyan(`vf build ${dir} --mock --preset draft`)}`);
}

async function call(messages: Anthropic.Beta.BetaMessageParam[]) {
  try {
    const stream = claude().beta.messages.stream({
      model: PLANNER_MODEL(),
      max_tokens: 64000,
      thinking: { type: "adaptive" },
      output_config: { effort: PLANNER_EFFORT() },
      // If a safety classifier declines, retry on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: plannerSystemPrompt(), cache_control: { type: "ephemeral" } }],
      messages,
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new Error(`Claude declined to plan this video (${msg.stop_details?.category ?? "no category"}).`);
    if (msg.stop_reason === "max_tokens") throw new Error("Planner ran out of output tokens. Split the brief into a shorter video.");
    return msg;
  } catch (e) {
    throw new Error(explainError(e));
  }
}

export function extractYAML(text: string): string {
  const fence = text.match(/```ya?ml\s*\n([\s\S]*?)```/);
  if (fence) return fence[1];
  const loose = text.match(/```\s*\n([\s\S]*?)```/);
  return loose ? loose[1] : text;
}
