import type { VoiceSpec } from "../spec/schema";
import type { Alignment } from "../text/narration";

export type Aspect = "16:9" | "9:16" | "1:1";

export type TTSRequest = {
  text: string;
  voice: VoiceSpec;
  previousText?: string;
  nextText?: string;
};

export type TTSResult = {
  audio: Buffer;
  ext: "mp3" | "wav";
  /** Character alignment if the provider returns one (ElevenLabs does). */
  alignment?: Alignment;
  model: string;
  costUsd: number;
};

export interface TTSProvider {
  name: string;
  /** Whether [bracket] audio tags should be sent to this engine. */
  keepAudioTags(voice: VoiceSpec): boolean;
  /** Everything that changes the output. Used as the cache key. */
  cacheKey(req: TTSRequest): unknown;
  synthesize(req: TTSRequest): Promise<TTSResult>;
}

export type MediaResult = {
  data: Buffer;
  ext: string;
  model: string;
  costUsd: number;
  credit?: string;
  /** Remote URL of the result (lets image-to-video skip a re-upload). */
  sourceUrl?: string;
};

export type ImageRequest = {
  prompt: string;
  negativePrompt?: string;
  aspect: Aspect;
  model?: string;
  seed?: number;
  /** Used by the placeholder provider so mock builds look on-brand. */
  palette?: { background: string; primary: string; accent: string; text: string };
  label?: string;
};

export interface ImageProvider {
  name: string;
  defaultModel: string;
  generate(req: ImageRequest): Promise<MediaResult>;
}

export type VideoRequest = {
  prompt: string;
  negativePrompt?: string;
  aspect: Aspect;
  durationSec: number;
  model?: string;
  seed?: number;
  /** Start frame for image-to-video models. */
  startImage?: { data: Buffer; ext: string; url?: string };
};

export interface VideoProvider {
  name: string;
  defaultModel: string;
  /** True when the model needs a start frame (we generate one first). */
  needsStartImage(model?: string): boolean;
  generate(req: VideoRequest): Promise<MediaResult>;
}

export type MusicRequest = { prompt: string; durationSec: number; model?: string };

export interface MusicProvider {
  name: string;
  generate(req: MusicRequest): Promise<MediaResult>;
}
