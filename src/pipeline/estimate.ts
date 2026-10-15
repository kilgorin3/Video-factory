import { FAL_IMAGE_MODELS, FAL_VIDEO_MODELS } from "../providers/fal";
import { aiImageFor, aiVideoFor, ttsFor } from "../providers";
import { MUSIC_USD_PER_MIN } from "../providers/music";
import type { VideoSpecT } from "../spec/schema";
import { parseNarration } from "../text/narration";
import { lintSpec } from "./lint";

export type EstimateLine = { item: string; quantity: string; usd: number };

const TTS_PER_1K: Record<string, number> = { elevenlabs: 0.2, openai: 0.017, command: 0, mock: 0 };
const IMAGE_COST: Record<string, number> = { openai: 0.25, pexels: 0, placeholder: 0 };

/**
 * What a full, uncached build will cost. Re-runs hit the asset cache, so
 * after the first build you only pay for scenes you change.
 */
export function estimateCost(spec: VideoSpecT): { lines: EstimateLine[]; totalUsd: number; minutes: number } {
  const lines: EstimateLine[] = [];
  const tts = ttsFor(spec, false);
  const chars = spec.scenes.reduce((a, s) => a + parseNarration(s.narration, { pronunciations: spec.pronunciations }).ttsText.length, 0);
  const ttsRate = (TTS_PER_1K[tts.name] ?? 0.2) * (/flash|turbo/.test(spec.voice.model ?? "") ? 0.5 : 1);
  lines.push({ item: `Narration (${tts.name})`, quantity: `${chars.toLocaleString()} chars`, usd: (chars / 1000) * ttsRate });

  const img = aiImageFor(spec, false);
  const imageModel = spec.providers.imageModel ?? img.defaultModel;
  const imgCost = img.name === "fal" ? (FAL_IMAGE_MODELS[imageModel]?.costUsd ?? 0.05) : (IMAGE_COST[img.name] ?? 0.05);
  const aiImages = spec.scenes.filter((s) => s.visual?.source === "ai-image").length;
  const aiVideos = spec.scenes.filter((s) => s.visual?.source === "ai-video");
  const vid = aiVideoFor(spec, false);
  const videoModel = spec.providers.videoModel ?? vid?.defaultModel ?? "";
  const needsStill = vid?.needsStartImage(videoModel) ?? false;
  const stills = aiImages + (needsStill ? aiVideos.length : 0);
  if (stills) lines.push({ item: `Images (${img.name} ${imageModel})`, quantity: `${stills}`, usd: stills * imgCost });

  if (aiVideos.length && vid) {
    const perSec = vid.name === "fal" ? (FAL_VIDEO_MODELS[videoModel]?.costPerSec ?? 0.15) : 0;
    const secs = aiVideos.reduce((a, s) => {
      const words = parseNarration(s.narration).words.length;
      return a + Math.min(10, Math.max(3, Math.ceil((words / 150) * 60 + 1)));
    }, 0);
    lines.push({ item: `AI video (${videoModel})`, quantity: `${aiVideos.length} clips, ~${secs}s`, usd: secs * perSec });
  }

  const minutes = lintSpec(spec).estimatedSeconds / 60;
  if (spec.music.source === "elevenlabs") {
    const m = Math.min(3, minutes);
    lines.push({ item: "Music (ElevenLabs)", quantity: `${m.toFixed(1)} min`, usd: m * MUSIC_USD_PER_MIN });
  }
  lines.push({ item: "Script planning (Claude, if you used vf plan)", quantity: "1 call", usd: 0.4 });
  const totalUsd = lines.reduce((a, l) => a + l.usd, 0);
  return { lines, totalUsd, minutes };
}
