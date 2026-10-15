import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, exists, hashOf, readJSON, writeJSON } from "../util/fsx";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function cacheRoot() {
  return process.env.VF_CACHE_DIR || path.join(repoRoot, ".vf-cache");
}

export type Cached<M> = { file: string; key: string; meta: M; hit: boolean };

/**
 * Content-addressed cache for anything that costs money to generate.
 * The key is a hash of every input that affects the output, so editing one
 * scene only regenerates that scene, and re-renders are free.
 */
export async function withCache<M>(
  kind: string,
  keyInput: unknown,
  produce: () => Promise<{ data: Buffer; ext: string; meta: M }>,
): Promise<Cached<M>> {
  const key = hashOf(keyInput);
  const dir = await ensureDir(path.join(cacheRoot(), kind));
  const metaFile = path.join(dir, `${key}.json`);
  if (exists(metaFile)) {
    const stored = await readJSON<{ ext: string; meta: M }>(metaFile);
    const file = path.join(dir, `${key}.${stored.ext}`);
    if (exists(file)) return { file, key, meta: stored.meta, hit: true };
  }
  const out = await produce();
  const file = path.join(dir, `${key}.${out.ext}`);
  await writeFile(file, out.data);
  await writeJSON(metaFile, { ext: out.ext, meta: out.meta, input: keyInput });
  return { file, key, meta: out.meta, hit: false };
}
