import React from "react";
import { AbsoluteFill, Img, Loop, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import type { VisualAsset } from "../../timeline/types";

/**
 * A scene's image or video. Stills get a slow Ken Burns push whose direction
 * varies by scene so consecutive images don't all move the same way.
 */
export const Media: React.FC<{
  visual: VisualAsset;
  /** Length of the scene the media sits in. */
  durationInFrames: number;
  seed: number;
  muted?: boolean;
  style?: React.CSSProperties;
}> = ({ visual, durationInFrames, seed, muted = true, style }) => {
  const frame = useCurrentFrame();
  const src = staticFile(visual.src);
  const fill: React.CSSProperties = { width: "100%", height: "100%", objectFit: visual.fit };

  if (visual.kind === "video") {
    const clip = visual.durationInFrames ?? durationInFrames;
    // Slow short clips down a little before resorting to a loop.
    const rate = Math.max(0.75, Math.min(1, clip / durationInFrames));
    const stretched = Math.floor(clip / rate);
    const video = <OffthreadVideo src={src} muted={muted} playbackRate={rate} style={fill} />;
    return (
      <AbsoluteFill style={{ overflow: "hidden", ...style }}>
        {stretched >= durationInFrames ? video : <Loop durationInFrames={Math.max(1, stretched - 1)}>{video}</Loop>}
      </AbsoluteFill>
    );
  }

  const p = frame / Math.max(1, durationInFrames);
  const moves = [
    { s: [1.04, 1.14], x: [0, -2], y: [0, -1.5] },
    { s: [1.14, 1.04], x: [-2, 1], y: [0, 0] },
    { s: [1.05, 1.15], x: [1.5, -1], y: [1, -1] },
    { s: [1.12, 1.03], x: [0, 0], y: [-1.5, 1] },
  ];
  const m = moves[seed % moves.length];
  const lerp = (a: number[]) => a[0] + (a[1] - a[0]) * p;
  const transform = visual.kenBurns
    ? `scale(${lerp(m.s)}) translate(${lerp(m.x)}%, ${lerp(m.y)}%)`
    : undefined;

  return (
    <AbsoluteFill style={{ overflow: "hidden", ...style }}>
      <Img src={src} style={{ ...fill, transform, transformOrigin: "50% 50%" }} />
    </AbsoluteFill>
  );
};
