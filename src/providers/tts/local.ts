import { exec } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ProviderError } from "../http";
import type { TTSProvider } from "../types";

const run = promisify(exec);

/** Silent WAV sized to a natural speaking rate. Lets the whole pipeline run with zero API keys. */
export const mockTTS: TTSProvider = {
  name: "mock",
  keepAudioTags: () => false,
  cacheKey: (req) => ({ p: "mock", text: req.text, speed: req.voice.speed, v: 2 }),
  async synthesize(req) {
    const words = req.text.split(/\s+/).filter(Boolean).length;
    const pauses = (req.text.match(/[.!?,;:]/g) ?? []).length * 0.12;
    const seconds = Math.max(0.6, (words / 2.55 + pauses) / req.voice.speed + 0.15);
    return { audio: silentWav(seconds), ext: "wav", model: "mock", costUsd: 0 };
  },
};

/**
 * Run any local TTS engine (Kokoro, Piper, XTTS, macOS `say`...).
 * voice.command example:  kokoro-tts {text_file} {out_file} --voice af_heart
 */
export const commandTTS: TTSProvider = {
  name: "command",
  keepAudioTags: () => false,
  cacheKey: (req) => ({ p: "command", text: req.text, cmd: req.voice.command }),
  async synthesize(req) {
    const template = req.voice.command;
    if (!template) throw new ProviderError("command", "voice.command is empty");
    const dir = await mkdtemp(path.join(os.tmpdir(), "vf-tts-"));
    try {
      const textFile = path.join(dir, "in.txt");
      const outFile = path.join(dir, "out.wav");
      await writeFile(textFile, req.text);
      const cmd = template.replaceAll("{text_file}", JSON.stringify(textFile)).replaceAll("{out_file}", JSON.stringify(outFile));
      await run(cmd, { timeout: 600_000 });
      return { audio: await readFile(outFile), ext: "wav", model: "command", costUsd: 0 };
    } catch (e) {
      throw new ProviderError("command", `TTS command failed: ${(e as Error).message}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
};

export function silentWav(seconds: number, sampleRate = 24000): Buffer {
  const samples = Math.round(seconds * sampleRate);
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}
