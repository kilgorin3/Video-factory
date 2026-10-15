import { fetchRetry, ProviderError, requireEnv } from "../http";
import type { TTSProvider, TTSRequest, TTSResult } from "../types";

/** George: warm, clear narrator from the default ElevenLabs library. Swap with `vf voices`. */
export const DEFAULT_ELEVEN_VOICE = "JBFqnCBsd6RMkjVDRZzb";
export const DEFAULT_ELEVEN_MODEL = "eleven_multilingual_v2";

/** Rough USD per 1k characters on a Creator/Pro plan. Flash/Turbo bill half. */
const USD_PER_1K = 0.2;

type Response = {
  audio_base64: string;
  alignment?: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  } | null;
};

const isV3 = (model: string) => model.startsWith("eleven_v3");

export const elevenlabsTTS: TTSProvider = {
  name: "elevenlabs",
  keepAudioTags: (voice) => isV3(voice.model ?? DEFAULT_ELEVEN_MODEL),
  cacheKey: (req) => ({ p: "elevenlabs", ...body(req), voice: voiceId(req), fmt: format() }),
  async synthesize(req: TTSRequest): Promise<TTSResult> {
    const key = requireEnv("ELEVENLABS_API_KEY", "elevenlabs");
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId(req)}/with-timestamps?output_format=${format()}`;
    const res = await fetchRetry("elevenlabs", url, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body(req)),
    });
    const json = (await res.json()) as Response;
    if (!json.audio_base64) throw new ProviderError("elevenlabs", "Response had no audio");
    const model = body(req).model_id;
    const rate = /flash|turbo/.test(model) ? USD_PER_1K / 2 : USD_PER_1K;
    return {
      audio: Buffer.from(json.audio_base64, "base64"),
      ext: "mp3",
      model,
      costUsd: (req.text.length / 1000) * rate,
      alignment: json.alignment
        ? {
            characters: json.alignment.characters,
            starts: json.alignment.character_start_times_seconds,
            ends: json.alignment.character_end_times_seconds,
          }
        : undefined,
    };
  },
};

function voiceId(req: TTSRequest) {
  return req.voice.voiceId ?? DEFAULT_ELEVEN_VOICE;
}

function format() {
  return process.env.ELEVENLABS_OUTPUT_FORMAT ?? "mp3_44100_128";
}

function body(req: TTSRequest) {
  const v = req.voice;
  const model = v.model ?? DEFAULT_ELEVEN_MODEL;
  return {
    text: req.text,
    model_id: model,
    voice_settings: {
      stability: v.stability ?? (isV3(model) ? 0.5 : 0.45),
      similarity_boost: v.similarity ?? 0.8,
      style: v.style ?? 0,
      use_speaker_boost: true,
      speed: v.speed,
    },
    // v3 rejects neighbour context; other models use it for smoother joins.
    ...(isV3(model) || !v.context
      ? {}
      : { previous_text: req.previousText || undefined, next_text: req.nextText || undefined }),
    seed: v.seed,
  };
}

/** List voices on the account (vf voices). */
export async function listElevenVoices(): Promise<{ id: string; name: string; labels: string }[]> {
  const key = requireEnv("ELEVENLABS_API_KEY", "elevenlabs");
  const res = await fetchRetry("elevenlabs", "https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
  });
  const json = (await res.json()) as {
    voices: { voice_id: string; name: string; labels?: Record<string, string> }[];
  };
  return json.voices.map((v) => ({
    id: v.voice_id,
    name: v.name,
    labels: Object.values(v.labels ?? {}).join(", "),
  }));
}
