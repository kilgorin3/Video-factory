import React, { createContext, useContext, useMemo } from "react";
import { useVideoConfig } from "remotion";
import type { Theme, Timeline } from "../timeline/types";
import { fontStacks } from "./theme-fonts";

type Ctx = {
  theme: Theme;
  fonts: { heading: string; body: string; mono: string };
  timeline: Timeline;
};

const ThemeContext = createContext<Ctx | null>(null);

export const ThemeProvider: React.FC<{ timeline: Timeline; children: React.ReactNode }> = ({
  timeline,
  children,
}) => {
  const theme = timeline.theme;
  const value = useMemo<Ctx>(
    () => ({
      theme,
      timeline,
      fonts: fontStacks(timeline),
    }),
    [theme, timeline],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}

/**
 * Layout units. Everything is designed on a 1080-pixel short edge; `u(px)`
 * scales that to the actual composition so 16:9, 9:16 and 1:1 share one design.
 */
export function useLayout() {
  const { width, height } = useVideoConfig();
  const { timeline } = useTheme();
  const k = Math.min(width, height) / 1080;
  const portrait = height > width;
  const square = height === width;
  const u = (px: number) => px * k;
  const captionsOn = timeline.captions.enabled;
  const padX = u(portrait ? 72 : square ? 84 : 120);
  const padTop = u(portrait ? 170 : 110);
  // Shorts overlay its title, channel and buttons on the bottom ~20%, so portrait keeps clear of it.
  const padBottom = u(captionsOn ? (portrait ? 560 : 190) : portrait ? 420 : 100);
  return { u, k, width, height, portrait, square, padX, padTop, padBottom };
}

/** Hex color with alpha (0-1). */
export function alpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function mix(a: string, b: string, t: number) {
  const pa = rgb(a);
  const pb = rgb(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function rgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
