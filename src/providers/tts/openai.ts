import { fetchRetry, requireEnv } from "../http";
import type { TTSProvider, TTSRequest } from "../types";

const DEFAULT_MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "coral";
/** ~$0.015 per minute of audio; ~900 chars per minute at 150 wpm. */
const USD_PER_1K_CHARS = 0.017;

function body(req: TTSRequest) {
  return {
    model: req.voice.model ?? DEFAULT_MODEL,
    voice: req.voice.voiceId ?? DEFAULT_VOICE,
    input: req.text,
    instructions:
      req.voice.instructions ??
      "Warm, clear, curious educator. Natural pacing, gentle emphasis on key terms.",
    response_format: "mp3",
    speed: req.voice.speed,
  };
}

/**
 * OpenAI TTS is cheap and steerable but returns no timestamps, so word timing
 * is estimated. Fine for captions; cue sync is tighter with ElevenLabs.
 */
export const openaiTTS: TTSProvider = {
  name: "openai",
  keepAudioTags: () => false,
  cacheKey: (req) => ({ p: "openai", ...body(req) }),
  async synthesize(req) {
    const key = requireEnv("OPENAI_API_KEY", "openai");
    const res = await fetchRetry("openai", "https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body(req)),
    });
    return {
      audio: Buffer.from(await res.arrayBuffer()),
      ext: "mp3",
      model: body(req).model,
      costUsd: (req.text.length / 1000) * USD_PER_1K_CHARS,
    };
  },
};
