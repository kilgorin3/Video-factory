import type { VideoSpecT } from "../spec/schema";
import { falImage, falVideo } from "./fal";
import { openaiImage } from "./image/openai";
import { placeholderImage } from "./image/placeholder";
import { pexelsImage, pexelsVideo } from "./image/stock";
import { elevenlabsMusic } from "./music";
import { elevenlabsTTS } from "./tts/elevenlabs";
import { commandTTS, mockTTS } from "./tts/local";
import { openaiTTS } from "./tts/openai";
import type { ImageProvider, MusicProvider, TTSProvider, VideoProvider } from "./types";

export function ttsFor(spec: VideoSpecT, mock: boolean): TTSProvider {
  if (mock) return mockTTS;
  switch (spec.voice.provider) {
    case "elevenlabs":
      return elevenlabsTTS;
    case "openai":
      return openaiTTS;
    case "command":
      return commandTTS;
    case "mock":
      return mockTTS;
  }
}

export function aiImageFor(spec: VideoSpecT, mock: boolean): ImageProvider {
  if (mock) return placeholderImage;
  switch (spec.providers.image) {
    case "fal":
      return falImage;
    case "openai":
      return openaiImage;
    case "pexels":
      return pexelsImage;
    case "placeholder":
      return placeholderImage;
  }
}

export function stockImageFor(mock: boolean): ImageProvider {
  return mock ? placeholderImage : pexelsImage;
}

/** Returns null in mock mode: the scene falls back to its still with a Ken Burns move. */
export function aiVideoFor(spec: VideoSpecT, mock: boolean): VideoProvider | null {
  if (mock || spec.providers.video === "placeholder") return null;
  return spec.providers.video === "pexels" ? pexelsVideo : falVideo;
}

export function stockVideoFor(mock: boolean): VideoProvider | null {
  return mock ? null : pexelsVideo;
}

export function musicFor(mock: boolean): MusicProvider | null {
  return mock ? null : elevenlabsMusic;
}

export { placeholderImage };
