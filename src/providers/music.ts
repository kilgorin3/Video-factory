import { fetchRetry, requireEnv } from "./http";
import type { MusicProvider } from "./types";

/** Rough USD per minute of generated music. Check your plan; this is for estimates only. */
export const MUSIC_USD_PER_MIN = 0.8;

/** ElevenLabs Music: prompt -> instrumental bed, cleared for commercial use on paid plans. */
export const elevenlabsMusic: MusicProvider = {
  name: "elevenlabs",
  async generate(req) {
    const key = requireEnv("ELEVENLABS_API_KEY", "elevenlabs");
    const ms = Math.round(Math.min(600, Math.max(10, req.durationSec)) * 1000);
    const res = await fetchRetry("elevenlabs", "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: req.prompt,
        music_length_ms: ms,
        force_instrumental: true,
        ...(req.model ? { model_id: req.model } : {}),
      }),
      timeoutMs: 600_000,
    });
    return {
      data: Buffer.from(await res.arrayBuffer()),
      ext: "mp3",
      model: req.model ?? "music_v1",
      costUsd: (ms / 60000) * MUSIC_USD_PER_MIN,
    };
  },
};
