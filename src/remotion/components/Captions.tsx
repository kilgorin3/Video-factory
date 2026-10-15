import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { groupCaptionLines } from "../../text/captions";
import { alpha, useLayout, useTheme } from "../theme";

/** Burned-in captions with the spoken word highlighted. ~85% of mobile viewers watch muted. */
export const Captions: React.FC = () => {
  const { timeline, theme, fonts } = useTheme();
  const frame = useCurrentFrame();
  const { u, portrait } = useLayout();
  const cfg = timeline.captions;
  const fps = timeline.meta.fps;

  const lines = useMemo(
    () => groupCaptionLines(cfg.words, { maxChars: cfg.maxChars, maxDuration: fps * 3.2, maxGap: fps * 0.6 }),
    [cfg.words, cfg.maxChars, fps],
  );
  if (!cfg.enabled) return null;
  // Kinetic scenes already put every spoken word on screen.
  const scene = timeline.scenes.findLast((s) => s.startFrame <= frame);
  if (scene?.type === "kinetic" && frame < scene.startFrame + scene.durationInFrames - 2) return null;

  const idx = lines.findIndex((l, i) => frame >= l.start - 2 && frame < Math.min(l.end + fps * 0.4, lines[i + 1]?.start ?? Infinity));
  if (idx < 0) return null;
  const line = lines[idx];
  const appear = interpolate(frame, [line.start - 2, line.start + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const c = theme.colors;
  const fontSize = u(portrait ? 58 : 44);

  return (
    <AbsoluteFill
      style={{
        justifyContent: cfg.position === "top" ? "flex-start" : "flex-end",
        alignItems: "center",
        paddingBottom: cfg.position === "bottom" ? u(portrait ? 420 : 64) : 0,
        paddingTop: cfg.position === "top" ? u(120) : 0,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: portrait ? "86%" : "78%",
          padding: `${u(14)}px ${u(28)}px`,
          borderRadius: u(18),
          background: alpha(theme.dark ? "#000000" : c.surface, theme.dark ? 0.55 : 0.82),
          backdropFilter: "blur(12px)",
          boxShadow: theme.dark ? undefined : `0 ${u(8)}px ${u(30)}px ${alpha("#000000", 0.12)}`,
          textAlign: "center",
          fontFamily: fonts.body,
          fontWeight: 600,
          fontSize,
          lineHeight: 1.25,
          color: c.text,
          opacity: appear,
          transform: `translateY(${(1 - appear) * u(8)}px)`,
        }}
      >
        {line.words.map((w, i) => {
          const active = frame >= w.start && frame < w.end + 2;
          const spoken = frame >= w.start;
          const highlight = cfg.style === "highlight";
          return (
            <span
              key={i}
              style={{
                color: highlight && active ? c.accent : c.text,
                opacity: highlight ? (spoken ? 1 : 0.6) : 1,
              }}
            >
              {w.text}
              {i < line.words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
