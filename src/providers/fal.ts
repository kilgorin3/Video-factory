import { sleep } from "../util/fsx";
import { download, fetchRetry, ProviderError, requireEnv } from "./http";
import type {
  Aspect,
  ImageProvider,
  ImageRequest,
  MediaResult,
  VideoProvider,
  VideoRequest,
} from "./types";

/**
 * fal.ai is one API key in front of most of the good image and video models
 * (Google Nano Banana / Veo, Kling, FLUX, Recraft, Seedance...). We talk to
 * its queue REST API directly so there is no SDK to keep in sync.
 *
 * Model ids and input shapes change; each preset below maps our generic
 * request to that model's inputs. Any other fal model id also works and gets
 * a best-effort generic input.
 */

type Json = Record<string, unknown>;

export async function falRun(model: string, input: Json, timeoutMs = 20 * 60_000): Promise<Json> {
  const key = requireEnv("FAL_KEY", "fal");
  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };
  const submit = await fetchRetry("fal", `https://queue.fal.run/${model}`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  const job = (await submit.json()) as { request_id: string; status_url: string; response_url: string };
  const deadline = Date.now() + timeoutMs;
  let wait = 1500;
  while (Date.now() < deadline) {
    const res = await fetchRetry("fal", job.status_url, { headers });
    const status = (await res.json()) as { status: string; error?: string };
    if (status.status === "COMPLETED") break;
    if (status.status === "FAILED" || status.error) {
      throw new ProviderError("fal", `${model} failed: ${status.error ?? "unknown error"}`);
    }
    await sleep(wait);
    wait = Math.min(wait * 1.3, 8000);
  }
  if (Date.now() >= deadline) throw new ProviderError("fal", `${model} timed out (request ${job.request_id})`);
  const result = await fetchRetry("fal", job.response_url, { headers });
  return (await result.json()) as Json;
}

const sizeEnum = (a: Aspect) =>
  a === "16:9" ? "landscape_16_9" : a === "9:16" ? "portrait_16_9" : "square_hd";

const withAvoid = (prompt: string, neg?: string) => (neg ? `${prompt}. Avoid: ${neg}.` : prompt);

type ImagePreset = { input: (r: ImageRequest) => Json; costUsd: number };

export const FAL_IMAGE_MODELS: Record<string, ImagePreset> = {
  // Best all-rounder: follows long prompts, consistent style, can render clean text.
  "fal-ai/nano-banana-pro": {
    costUsd: 0.15,
    input: (r) => ({
      prompt: withAvoid(r.prompt, r.negativePrompt),
      aspect_ratio: r.aspect,
      resolution: "2K",
      num_images: 1,
      output_format: "png",
    }),
  },
  // Pennies per image. Great for drafts and iterating on a storyboard.
  "fal-ai/flux/schnell": {
    costUsd: 0.006,
    input: (r) => ({
      prompt: r.prompt,
      image_size: sizeEnum(r.aspect),
      num_images: 1,
      output_format: "png",
      seed: r.seed,
    }),
  },
  // Photoreal, high resolution.
  "fal-ai/flux-pro/v1.1-ultra": {
    costUsd: 0.06,
    input: (r) => ({
      prompt: r.prompt,
      aspect_ratio: r.aspect,
      output_format: "png",
      seed: r.seed,
    }),
  },
  // Flat illustration / vector look that suits explainer videos.
  "fal-ai/recraft/v3/text-to-image": {
    costUsd: 0.04,
    input: (r) => ({
      prompt: r.prompt,
      image_size: sizeEnum(r.aspect),
      style: "digital_illustration",
    }),
  },
};

export const DEFAULT_FAL_IMAGE_MODEL = "fal-ai/nano-banana-pro";

export const falImage: ImageProvider = {
  name: "fal",
  defaultModel: DEFAULT_FAL_IMAGE_MODEL,
  async generate(req): Promise<MediaResult> {
    const model = req.model ?? DEFAULT_FAL_IMAGE_MODEL;
    const preset = FAL_IMAGE_MODELS[model];
    const input = preset
      ? preset.input(req)
      : { prompt: withAvoid(req.prompt, req.negativePrompt), aspect_ratio: req.aspect, seed: req.seed };
    const out = (await falRun(model, input)) as { images?: { url: string; content_type?: string }[] };
    const img = out.images?.[0];
    if (!img) throw new ProviderError("fal", `${model} returned no image`);
    return {
      data: await download("fal", img.url),
      ext: img.content_type?.includes("jpeg") ? "jpg" : "png",
      model,
      costUsd: preset?.costUsd ?? 0.05,
      sourceUrl: img.url,
    };
  },
};

type VideoPreset = {
  imageToVideo: boolean;
  costPerSec: number;
  input: (r: VideoRequest, imageUrl?: string) => Json;
};

const clampDur = (s: number, min: number, max: number) => Math.min(max, Math.max(min, Math.ceil(s)));

export const FAL_VIDEO_MODELS: Record<string, VideoPreset> = {
  // Default: animate our own still, so b-roll matches the video's art style.
  "fal-ai/kling-video/v3/standard/image-to-video": {
    imageToVideo: true,
    costPerSec: 0.084,
    input: (r, imageUrl) => ({
      prompt: r.prompt,
      start_image_url: imageUrl,
      duration: String(clampDur(r.durationSec, 3, 10)),
      generate_audio: false,
      negative_prompt: r.negativePrompt ?? "blur, distort, low quality",
    }),
  },
  "fal-ai/kling-video/v3/pro/image-to-video": {
    imageToVideo: true,
    costPerSec: 0.112,
    input: (r, imageUrl) => ({
      prompt: r.prompt,
      start_image_url: imageUrl,
      duration: String(clampDur(r.durationSec, 3, 10)),
      generate_audio: false,
      negative_prompt: r.negativePrompt ?? "blur, distort, low quality",
    }),
  },
  // Text-to-video, cinematic. fal lists this endpoint as deprecated after 2026-11-17;
  // swap in its successor id when it lands.
  "fal-ai/veo3.1/fast": {
    imageToVideo: false,
    costPerSec: 0.1,
    input: (r) => ({
      prompt: r.prompt,
      aspect_ratio: r.aspect === "1:1" ? "16:9" : r.aspect,
      duration: "8s",
      resolution: "1080p",
      generate_audio: false,
    }),
  },
};

export const DEFAULT_FAL_VIDEO_MODEL = "fal-ai/kling-video/v3/standard/image-to-video";

export const falVideo: VideoProvider = {
  name: "fal",
  defaultModel: DEFAULT_FAL_VIDEO_MODEL,
  needsStartImage: (model) => FAL_VIDEO_MODELS[model ?? DEFAULT_FAL_VIDEO_MODEL]?.imageToVideo ?? /image-to-video/.test(model ?? ""),
  async generate(req): Promise<MediaResult> {
    const model = req.model ?? DEFAULT_FAL_VIDEO_MODEL;
    const preset = FAL_VIDEO_MODELS[model];
    const imageUrl =
      req.startImage?.url ??
      (req.startImage
        ? `data:image/${req.startImage.ext === "jpg" ? "jpeg" : req.startImage.ext};base64,${req.startImage.data.toString("base64")}`
        : undefined);
    const input = preset
      ? preset.input(req, imageUrl)
      : { prompt: req.prompt, image_url: imageUrl, aspect_ratio: req.aspect };
    const out = (await falRun(model, input, 30 * 60_000)) as { video?: { url: string } };
    if (!out.video?.url) throw new ProviderError("fal", `${model} returned no video`);
    const seconds = preset ? Number(String(input.duration ?? "8").replace("s", "")) : req.durationSec;
    return {
      data: await download("fal", out.video.url),
      ext: "mp4",
      model,
      costUsd: (preset?.costPerSec ?? 0.15) * seconds,
      sourceUrl: out.video.url,
    };
  },
};
