import { parseFile } from "music-metadata";

/** Duration in seconds of an audio or video file (mp3, wav, m4a, mp4, mov...). */
export async function mediaDuration(file: string): Promise<number> {
  const meta = await parseFile(file, { duration: true, skipCovers: true });
  const d = meta.format.duration;
  if (!d || !Number.isFinite(d)) throw new Error(`Could not read duration of ${file}`);
  return d;
}

export const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/i;
export const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;
