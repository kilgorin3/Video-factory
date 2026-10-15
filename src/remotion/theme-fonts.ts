import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import type { Timeline } from "../timeline/types";
import { ensureFont } from "./fonts";

const requested = new Set<string>();

const FALLBACK = { heading: "system-ui, sans-serif", body: "system-ui, sans-serif", mono: "ui-monospace, monospace" };

/**
 * Register the build's vendored font files (no network at render time).
 * Older timelines without a font list fall back to loading from Google.
 */
export function fontStacks(timeline: Timeline) {
  const f = timeline.theme.fonts;
  if (!timeline.fonts) {
    return {
      heading: ensureFont(f.heading, FALLBACK.heading),
      body: ensureFont(f.body, FALLBACK.body),
      mono: ensureFont(f.mono, FALLBACK.mono),
    };
  }
  for (const file of timeline.fonts) {
    const key = `${file.family}|${file.weight}|${file.src}`;
    if (requested.has(key)) continue;
    requested.add(key);
    loadFont({ family: file.family, url: staticFile(file.src), weight: file.weight, unicodeRange: file.unicodeRange, format: "woff2" });
  }
  const have = new Set(timeline.fonts.map((x) => x.family));
  const stack = (family: string, fallback: string) => (have.has(family) ? `"${family}", ${fallback}` : fallback);
  return { heading: stack(f.heading, FALLBACK.heading), body: stack(f.body, FALLBACK.body), mono: stack(f.mono, FALLBACK.mono) };
}
