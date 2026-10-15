import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { aiImageFor, aiVideoFor, musicFor, stockImageFor, stockVideoFor, ttsFor } from "../providers";
import type { Aspect, ImageProvider, MediaResult } from "../providers/types";
import { sceneLabel } from "../spec/load";
import type { SceneSpec, VideoSpecT, VisualSpec } from "../spec/schema";
import {
  cueTimes,
  estimateAlignment,
  parseNarration,
  wordsFromAlignment,
  type Alignment,
  type TimedWord,
} from "../text/narration";
import type { Theme, VisualAsset } from "../timeline/types";
import { copyInto, ensureDir, pad2 } from "../util/fsx";
import { log } from "../util/log";
import { withCache } from "./cache";
import type { Manifest } from "./manifest";
import { mediaDuration, VIDEO_EXT } from "./media";
import type { Project } from "./project";

export type BuildContext = {
  project: Project;
  mock: boolean;
  manifest: Manifest;
};

export type VoiceAsset = {
  scene: number;
  /** Path relative to the public dir. */
  src: string;
  durationSec: number;
  /** Seconds from the start of this clip. */
  words: TimedWord[];
  cues: Record<string, number>;
};

export type SceneVisual = VisualAsset & { poster?: string };

async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Copy a cached file into the Remotion public dir under a stable, cache-busting name. */
async function publish(ctx: BuildContext, file: string, folder: string, base: string, key: string) {
  const ext = path.extname(file);
  const rel = `${folder}/${base}-${key.slice(0, 8)}${ext}`;
  await copyInto(file, path.join(ctx.project.paths.public, rel));
  return rel;
}

// ---------------------------------------------------------------- voice

export async function buildVoice(ctx: BuildContext): Promise<(VoiceAsset | null)[]> {
  const { spec } = ctx.project;
  const tts = ttsFor(spec, ctx.mock);
  log.step(`Narration (${tts.name}${spec.voice.model ? ` / ${spec.voice.model}` : ""})`);
  const parsed = spec.scenes.map((s) =>
    parseNarration(s.narration, {
      pronunciations: spec.pronunciations,
      keepAudioTags: tts.keepAudioTags(spec.voice),
    }),
  );

  const results = await pool(spec.scenes, Number(process.env.VF_TTS_CONCURRENCY ?? 3), async (scene, i) => {
    const p = parsed[i];
    if (p.words.length === 0) return null;
    const req = {
      text: p.ttsText,
      voice: spec.voice,
      previousText: parsed[i - 1]?.ttsText,
      nextText: parsed[i + 1]?.ttsText,
    };
    const cached = await withCache<{ alignment: Alignment | null; durationSec: number; model: string; costUsd: number }>(
      "voice",
      tts.cacheKey(req),
      async () => {
        const res = await tts.synthesize(req);
        const tmp = path.join(await ensureDir(path.join(ctx.project.paths.build, "tmp")), `tts-${i}.${res.ext}`);
        await writeFile(tmp, res.audio);
        const durationSec = await mediaDuration(tmp);
        return {
          data: res.audio,
          ext: res.ext,
          meta: { alignment: res.alignment ?? null, durationSec, model: res.model, costUsd: res.costUsd },
        };
      },
    );
    const { alignment, durationSec, model, costUsd } = cached.meta;
    const words = wordsFromAlignment(p, alignment ?? estimateAlignment(p.ttsText, durationSec));
    const src = await publish(ctx, cached.file, "audio", `scene-${pad2(i + 1)}`, cached.key);
    ctx.manifest.add({ scene: i + 1, kind: "voice", provider: tts.name, model, file: src, costUsd, cached: cached.hit });
    log.ok(`${sceneLabel(scene, i)}  ${durationSec.toFixed(1)}s${cached.hit ? "  (cached)" : ""}${alignment ? "" : "  (timing estimated)"}`);
    return { scene: i, src, durationSec, words, cues: cueTimes(p, words) } satisfies VoiceAsset;
  });
  return results;
}

// ---------------------------------------------------------------- visuals

export function composePrompt(prompt: string, style: string) {
  const s = style.trim();
  return s ? `${prompt.trim().replace(/\.$/, "")}. Style: ${s}` : prompt.trim();
}

async function image(
  ctx: BuildContext,
  provider: ImageProvider,
  sceneIdx: number,
  prompt: string,
  v: VisualSpec,
  aspect: Aspect,
  theme: Theme,
) {
  const { spec } = ctx.project;
  const model = v.model ?? spec.providers.imageModel ?? provider.defaultModel;
  const req = {
    prompt,
    negativePrompt: spec.style.negativePrompt || undefined,
    aspect,
    model,
    seed: v.seed,
    palette: theme.colors,
    label: v.prompt ?? v.query,
  };
  const cached = await withCache<{ model: string; costUsd: number; credit?: string; sourceUrl?: string }>(
    "image",
    { p: provider.name, ...req, palette: provider.name === "placeholder" ? req.palette : undefined },
    async () => {
      const r: MediaResult = await provider.generate(req);
      return { data: r.data, ext: r.ext, meta: { model: r.model, costUsd: r.costUsd, credit: r.credit, sourceUrl: r.sourceUrl } };
    },
  );
  const src = await publish(ctx, cached.file, "visuals", `scene-${pad2(sceneIdx + 1)}`, cached.key);
  ctx.manifest.add({
    scene: sceneIdx + 1,
    kind: "image",
    provider: provider.name,
    model: cached.meta.model,
    prompt,
    file: src,
    costUsd: cached.meta.costUsd,
    cached: cached.hit,
    credit: cached.meta.credit,
  });
  return { src, file: cached.file, ...cached.meta, hit: cached.hit };
}

export async function buildVisuals(ctx: BuildContext, voices: (VoiceAsset | null)[]): Promise<(SceneVisual | null)[]> {
  const { spec, theme } = ctx.project;
  const aspect = spec.format.aspect;
  log.step(`Visuals (images: ${ctx.mock ? "placeholder" : spec.providers.image}, video: ${ctx.mock ? "stills" : spec.providers.video})`);

  return pool(spec.scenes, Number(process.env.VF_MEDIA_CONCURRENCY ?? 3), async (scene, i): Promise<SceneVisual | null> => {
    const v = scene.visual;
    if (!v || v.source === "none") return null;
    const label = sceneLabel(scene, i);
    const base = { fit: v.fit, kenBurns: v.kenBurns, credit: v.credit } as const;
    const estSeconds = (voices[i]?.durationSec ?? scene.duration ?? 5) + 1;

    if (v.source === "file") {
      const abs = path.resolve(ctx.project.dir, v.file!);
      const isVideo = VIDEO_EXT.test(abs);
      const rel = `user/${path.basename(abs)}`;
      await copyInto(abs, path.join(ctx.project.paths.public, rel));
      ctx.manifest.add({ scene: i + 1, kind: "file", provider: "file", model: "-", file: rel, costUsd: 0, cached: true });
      log.ok(`${label}  file ${v.file}`);
      return isVideo
        ? { kind: "video", src: rel, ...base, durationInFrames: Math.floor((await mediaDuration(abs)) * spec.format.fps) }
        : { kind: "image", src: rel, ...base };
    }

    if (v.source === "ai-image" || v.source === "stock-image") {
      const provider = v.source === "ai-image" ? aiImageFor(spec, ctx.mock) : stockImageFor(ctx.mock);
      const prompt = v.source === "ai-image" ? composePrompt(v.prompt!, spec.style.imageStyle) : (v.query ?? v.prompt!);
      const img = await image(ctx, provider, i, prompt, v, aspect, theme);
      log.ok(`${label}  ${provider.name} image${img.hit ? "  (cached)" : `  $${img.costUsd.toFixed(3)}`}`);
      return { kind: "image", src: img.src, ...base, credit: v.credit ?? img.credit };
    }

    // ai-video / stock-video
    const videoProvider = v.source === "ai-video" ? aiVideoFor(spec, ctx.mock) : stockVideoFor(ctx.mock);
    const stillProvider = v.source === "ai-video" ? aiImageFor(spec, ctx.mock) : stockImageFor(ctx.mock);
    const stillPrompt = v.source === "ai-video" ? composePrompt(v.prompt!, spec.style.imageStyle) : (v.query ?? v.prompt!);

    if (!videoProvider) {
      const still = await image(ctx, stillProvider, i, stillPrompt, v, aspect, theme);
      log.ok(`${label}  still in place of video (mock)`);
      return { kind: "image", src: still.src, ...base, kenBurns: true };
    }

    const model = v.model ?? spec.providers.videoModel ?? videoProvider.defaultModel;
    let start: Awaited<ReturnType<typeof image>> | undefined;
    if (v.source === "ai-video" && videoProvider.needsStartImage(model)) {
      start = await image(ctx, stillProvider, i, stillPrompt, { ...v, model: undefined }, aspect, theme);
    }
    const motion = v.source === "ai-video" ? composePrompt(v.motion ?? v.prompt!, spec.style.imageStyle) : stillPrompt;
    const req = {
      prompt: motion,
      negativePrompt: spec.style.negativePrompt || undefined,
      aspect,
      durationSec: estSeconds,
      model,
      seed: v.seed,
    };
    const cached = await withCache<{ model: string; costUsd: number; credit?: string }>(
      "video",
      { p: videoProvider.name, ...req, durationSec: Math.ceil(Math.min(estSeconds, 10)), start: start?.file ? path.basename(start.file) : null },
      async () => {
        const r = await videoProvider.generate({
          ...req,
          startImage: start
            ? { data: await readFile(start.file), ext: path.extname(start.file).slice(1), url: start.sourceUrl }
            : undefined,
        });
        return { data: r.data, ext: r.ext, meta: { model: r.model, costUsd: r.costUsd, credit: r.credit } };
      },
    );
    const src = await publish(ctx, cached.file, "visuals", `scene-${pad2(i + 1)}`, cached.key);
    ctx.manifest.add({
      scene: i + 1,
      kind: "video",
      provider: videoProvider.name,
      model: cached.meta.model,
      prompt: motion,
      file: src,
      costUsd: cached.meta.costUsd,
      cached: cached.hit,
      credit: cached.meta.credit,
    });
    log.ok(`${label}  ${videoProvider.name} video${cached.hit ? "  (cached)" : `  $${cached.meta.costUsd.toFixed(2)}`}`);
    return {
      kind: "video",
      src,
      ...base,
      credit: v.credit ?? cached.meta.credit,
      durationInFrames: Math.floor((await mediaDuration(cached.file)) * spec.format.fps),
      poster: start?.src,
    };
  });
}

// ---------------------------------------------------------------- music

export async function buildMusic(ctx: BuildContext, totalSec: number): Promise<string | null> {
  const { spec } = ctx.project;
  if (spec.music.source === "none") return null;
  log.step("Music");
  if (spec.music.source === "file") {
    const abs = path.resolve(ctx.project.dir, spec.music.file!);
    const rel = `music/${path.basename(abs)}`;
    await copyInto(abs, path.join(ctx.project.paths.public, rel));
    ctx.manifest.add({ scene: null, kind: "music", provider: "file", model: "-", file: rel, costUsd: 0, cached: true });
    log.ok(`using ${spec.music.file}`);
    return rel;
  }
  const provider = musicFor(ctx.mock);
  if (!provider) {
    log.warn("mock build: skipping generated music");
    return null;
  }
  // Generate up to 3 minutes and loop; long beds cost more and nobody notices the loop under narration.
  const req = { prompt: spec.music.prompt!, durationSec: Math.min(totalSec + 2, 180), model: spec.music.model };
  const cached = await withCache<{ model: string; costUsd: number }>("music", { p: provider.name, ...req }, async () => {
    const r = await provider.generate(req);
    return { data: r.data, ext: r.ext, meta: { model: r.model, costUsd: r.costUsd } };
  });
  const src = await publish(ctx, cached.file, "music", "bed", cached.key);
  ctx.manifest.add({
    scene: null,
    kind: "music",
    provider: provider.name,
    model: cached.meta.model,
    prompt: req.prompt,
    file: src,
    costUsd: cached.meta.costUsd,
    cached: cached.hit,
  });
  log.ok(`${provider.name} bed ${Math.round(req.durationSec)}s${cached.hit ? "  (cached)" : ""}`);
  return src;
}

// ---------------------------------------------------------------- small files

export async function publishUserFile(ctx: BuildContext, rel: string): Promise<string> {
  const abs = path.resolve(ctx.project.dir, rel);
  const out = `user/${rel.replace(/[\\/]/g, "_")}`;
  await copyInto(abs, path.join(ctx.project.paths.public, out));
  return out;
}

export type { SceneSpec };
