import { fetchRetry, ProviderError, requireEnv } from "../http";
import type { ImageProvider, MediaResult } from "../types";

const SIZES = { "16:9": "1536x1024", "9:16": "1024x1536", "1:1": "1024x1024" } as const;

/** OpenAI image generation. Strong prompt adherence; landscape is 3:2 so it gets cropped to fill. */
export const openaiImage: ImageProvider = {
  name: "openai",
  defaultModel: "gpt-image-1",
  async generate(req): Promise<MediaResult> {
    const key = requireEnv("OPENAI_API_KEY", "openai");
    const model = req.model ?? "gpt-image-1";
    const res = await fetchRetry("openai", "https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: req.negativePrompt ? `${req.prompt}. Avoid: ${req.negativePrompt}.` : req.prompt,
        size: SIZES[req.aspect],
        quality: "high",
        n: 1,
      }),
      timeoutMs: 300_000,
    });
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new ProviderError("openai", "No image returned");
    return { data: Buffer.from(b64, "base64"), ext: "png", model, costUsd: 0.25 };
  },
};
