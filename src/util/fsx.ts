import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function writeJSON(file: string, data: unknown) {
  await ensureDir(path.dirname(file));
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

export async function readJSON<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export function exists(p: string) {
  return existsSync(p);
}

export async function copyInto(src: string, dest: string) {
  await ensureDir(path.dirname(dest));
  // Skip the copy when the destination is already identical in size+mtime.
  if (existsSync(dest)) {
    const [a, b] = await Promise.all([stat(src), stat(dest)]);
    if (a.size === b.size && a.mtimeMs <= b.mtimeMs) return dest;
  }
  await copyFile(src, dest);
  return dest;
}

/** Stable hash of any JSON-able value (key order independent). */
export function hashOf(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 20);
}

function stableStringify(v: unknown): string {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const entries = Object.entries(v as Record<string, unknown>)
    .filter(([, val]) => val !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, val]) => `${JSON.stringify(k)}:${stableStringify(val)}`).join(",")}}`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}
