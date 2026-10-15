import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { alpha, useLayout, useTheme } from "../theme";

/** Thin chapter-segmented progress bar along the top edge. */
export const ProgressBar: React.FC = () => {
  const { timeline, theme } = useTheme();
  const frame = useCurrentFrame();
  const { u } = useLayout();
  if (!timeline.chrome.progressBar) return null;
  const total = timeline.meta.durationInFrames;
  const marks = timeline.chapters.length ? timeline.chapters : [{ title: "", startFrame: 0 }];
  const gap = u(6);
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: u(7), display: "flex", gap }}>
      {marks.map((m, i) => {
        const end = marks[i + 1]?.startFrame ?? total;
        const p = Math.min(1, Math.max(0, (frame - m.startFrame) / Math.max(1, end - m.startFrame)));
        return (
          <div key={i} style={{ flex: end - m.startFrame, background: alpha(theme.colors.text, 0.12), overflow: "hidden" }}>
            <div style={{ width: `${p * 100}%`, height: "100%", background: theme.colors.primary }} />
          </div>
        );
      })}
    </div>
  );
};

/** Current chapter name in a small pill, top-left. Re-animates on each new chapter. */
export const ChapterLabel: React.FC<{ title: string | null; number: number; startedAt: number }> = ({
  title,
  number,
  startedAt,
}) => {
  const { timeline, theme, fonts } = useTheme();
  const frame = useCurrentFrame();
  const { u, padX } = useLayout();
  if (!timeline.chrome.chapterLabel || !title) return null;
  const p = interpolate(frame - startedAt, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: u(40),
        left: padX,
        display: "flex",
        alignItems: "center",
        gap: u(12),
        padding: `${u(10)}px ${u(20)}px`,
        borderRadius: 999,
        background: alpha(theme.colors.surface, theme.dark ? 0.7 : 0.9),
        border: `1px solid ${alpha(theme.colors.text, 0.1)}`,
        fontFamily: fonts.body,
        fontSize: u(24),
        fontWeight: 600,
        color: theme.colors.muted,
        opacity: p,
        transform: `translateY(${(1 - p) * -u(12)}px)`,
      }}
    >
      <span style={{ color: theme.colors.primary, fontFamily: fonts.mono }}>{String(number).padStart(2, "0")}</span>
      <span style={{ color: theme.colors.text }}>{title}</span>
    </div>
  );
};

export const Logo: React.FC = () => {
  const { timeline } = useTheme();
  const { u, padX } = useLayout();
  if (!timeline.chrome.logo) return null;
  return (
    <Img
      src={staticFile(timeline.chrome.logo)}
      style={{ position: "absolute", top: u(36), right: padX, height: u(54), opacity: 0.85, objectFit: "contain" }}
    />
  );
};

export const Credit: React.FC<{ text?: string }> = ({ text }) => {
  const { theme, fonts } = useTheme();
  const { u, padX } = useLayout();
  if (!text) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          right: padX,
          top: u(44),
          fontFamily: fonts.body,
          fontSize: u(18),
          color: alpha("#FFFFFF", 0.75),
          textShadow: "0 1px 4px rgba(0,0,0,0.6)",
          ...(theme.dark ? {} : {}),
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
