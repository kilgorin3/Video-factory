import type React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig, type SpringConfig } from "remotion";
import type { Theme } from "../../timeline/types";
import { useTheme } from "../theme";

const SPRINGS: Record<Theme["motion"], Partial<SpringConfig>> = {
  snappy: { damping: 14, stiffness: 190, mass: 0.6 },
  smooth: { damping: 20, stiffness: 120, mass: 0.9 },
  calm: { damping: 26, stiffness: 80, mass: 1.1 },
};

/** 0 -> 1 spring that starts at `delay` frames, tuned to the theme's motion style. */
export function useEnter(delay = 0, opts: { slower?: boolean } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme } = useTheme();
  const cfg = SPRINGS[theme.motion];
  return spring({
    frame: frame - delay,
    fps,
    config: opts.slower ? { ...cfg, mass: (cfg.mass ?? 1) * 1.6 } : cfg,
  });
}

/** Standard entrance: rise + fade + de-blur. */
export function enterStyle(p: number, distance: number, blur = 10): React.CSSProperties {
  return {
    opacity: Math.min(1, p * 1.4),
    transform: `translateY(${(1 - p) * distance}px)`,
    filter: p < 0.999 ? `blur(${(1 - Math.min(1, p)) * blur}px)` : undefined,
  };
}

export function enterFromLeft(p: number, distance: number): React.CSSProperties {
  return {
    opacity: Math.min(1, p * 1.5),
    transform: `translateX(${(1 - p) * -distance}px)`,
  };
}

/** Linear 0..1 over a window with easing; handy for counters and path drawing. */
export function progress(frame: number, start: number, length: number, ease = Easing.out(Easing.cubic)) {
  return interpolate(frame, [start, start + Math.max(1, length)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
}

/** Frame at which a cue fires, falling back to a default. */
export function cueAt(cues: Record<string, number>, name: string | undefined, fallback: number) {
  return name && cues[name] !== undefined ? cues[name] : fallback;
}
