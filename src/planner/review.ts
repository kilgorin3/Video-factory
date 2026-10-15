import type Anthropic from "@anthropic-ai/sdk";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { loadProject } from "../pipeline/project";
import { parseNarration } from "../text/narration";
import { ensureDir } from "../util/fsx";
import { log } from "../util/log";
import { claude, explainError, PLANNER_EFFORT, PLANNER_MODEL, textOf } from "./claude";
import { reviewSystemPrompt } from "./prompts";

/** Fact-check the narration (with web search) and write build/review.md. */
export async function reviewProject(dir: string) {
  const p = await loadProject(dir, { strict: false });
  const script = p.spec.scenes
    .map((s, i) => {
      const extra: string[] = [];
      if (s.type === "stat") extra.push(`On screen: ${s.prefix}${s.value}${s.suffix} ${s.label}${s.source ? ` (source: ${s.source})` : ""}`);
      if (s.type === "chart") extra.push(`Chart: ${s.data.map((d) => `${d.label}=${d.value}${s.unit}`).join(", ")}${s.source ? ` (source: ${s.source})` : ""}`);
      if (s.type === "definition") extra.push(`Definition: ${s.term}: ${s.definition}`);
      if (s.type === "quote") extra.push(`Quote: "${s.quote}" ${s.author ?? ""}`);
      return `### Scene ${i + 1} (${s.type})\n${parseNarration(s.narration).displayText}${extra.length ? `\n${extra.join("\n")}` : ""}`;
    })
    .join("\n\n");

  log.step(`Fact-checking with ${PLANNER_MODEL()} + web search`);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `Video: ${p.spec.title}\nAudience: ${p.spec.scope.audience ?? "general"}\n\n${script}`,
    },
  ];
  let report = "";
  try {
    for (let turn = 0; turn < 4; turn++) {
      const msg = await claude()
        .beta.messages.stream({
          model: PLANNER_MODEL(),
          max_tokens: 32000,
          thinking: { type: "adaptive" },
          output_config: { effort: PLANNER_EFFORT() },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: reviewSystemPrompt(),
          tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 10 }],
          messages,
        })
        .finalMessage();
      report += textOf(msg.content);
      if (msg.stop_reason === "pause_turn") {
        // Long server-side tool runs pause; resume by sending the turn back.
        messages.push({ role: "assistant", content: msg.content });
        continue;
      }
      if (msg.stop_reason === "refusal") throw new Error("Claude declined to review this script.");
      break;
    }
  } catch (e) {
    throw new Error(explainError(e));
  }
  const out = path.join(await ensureDir(p.paths.build), "review.md");
  await writeFile(out, `# Fact-check: ${p.spec.title}\n\n${report.trim()}\n`);
  log.ok(`Wrote ${out}`);
}
