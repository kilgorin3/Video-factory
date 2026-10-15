import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import type { VideoProps } from "../timeline/types";
import { alpha, ThemeProvider, useTheme } from "./theme";

/**
 * 1280x720 thumbnail: one image, at most ~5 huge words, high contrast.
 * Thumbnails decide click-through more than anything inside the video.
 */
export const Thumbnail: React.FC<VideoProps> = ({ timeline }) => (
  <ThemeProvider timeline={timeline}>
    <ThumbnailInner />
  </ThemeProvider>
);

const ThumbnailInner: React.FC = () => {
  const { timeline, theme, fonts } = useTheme();
  const c = theme.colors;
  const words = timeline.thumbnail.title.trim().split(/\s+/);
  const last = words.pop() ?? "";
  const size = words.length + 1 <= 3 ? 150 : words.length + 1 <= 5 ? 118 : 92;
  const img = timeline.thumbnail.image;

  return (
    <AbsoluteFill style={{ background: c.background }}>
      {img ? (
        <AbsoluteFill style={{ left: "38%" }}>
          <Img src={staticFile(img)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{ background: `radial-gradient(70% 90% at 85% 40%, ${alpha(c.primary, 0.55)}, transparent 70%), radial-gradient(50% 60% at 100% 100%, ${alpha(c.accent, 0.45)}, transparent 70%)` }}
        />
      )}
      <AbsoluteFill
        style={{ background: `linear-gradient(90deg, ${c.background} 34%, ${alpha(c.background, 0.75)} 52%, ${alpha(c.background, 0)} 78%)` }}
      />
      <AbsoluteFill style={{ padding: "64px 70px", justifyContent: "center" }}>
        <div style={{ width: 120, height: 14, borderRadius: 7, background: c.accent, marginBottom: 34 }} />
        <div
          style={{
            maxWidth: "70%",
            fontFamily: fonts.heading,
            fontWeight: 800,
            fontSize: size,
            lineHeight: 0.98,
            letterSpacing: "-0.035em",
            color: c.text,
            textShadow: `0 6px 30px ${alpha("#000000", 0.35)}`,
            textTransform: "uppercase",
          }}
        >
          {words.join(" ")} <span style={{ color: c.accent }}>{last}</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ border: `10px solid ${c.primary}`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
