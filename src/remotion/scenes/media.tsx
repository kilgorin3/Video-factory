import React from "react";
import { AbsoluteFill } from "remotion";
import type { SceneOf } from "../../spec/schema";
import { Credit } from "../components/Chrome";
import { Media } from "../components/Media";
import { Heading, SceneShell, useScene, useSceneData } from "../components/kit";
import { enterStyle, useEnter } from "../lib/anim";
import { alpha, useLayout, useTheme } from "../theme";

type CaptionSpec = { title?: string; text?: string } | undefined;

const MediaCaption: React.FC<{ caption: CaptionSpec }> = ({ caption }) => {
  const { theme, fonts } = useTheme();
  const { u, padX, padBottom, portrait } = useLayout();
  const p = useEnter(10);
  if (!caption || (!caption.title && !caption.text)) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: padX,
        bottom: padBottom,
        maxWidth: portrait ? `calc(100% - ${padX * 2}px)` : "58%",
        ...enterStyle(p, u(24)),
      }}
    >
      {caption.title ? (
        <div
          style={{
            fontFamily: fonts.heading,
            fontWeight: 800,
            fontSize: u(portrait ? 64 : 72),
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "#FFFFFF",
            textShadow: "0 2px 18px rgba(0,0,0,0.45)",
            marginBottom: u(16),
          }}
        >
          {caption.title}
        </div>
      ) : null}
      {caption.text ? (
        <div
          style={{
            display: "inline-block",
            fontFamily: fonts.body,
            fontSize: u(36),
            lineHeight: 1.4,
            color: "#FFFFFF",
            padding: `${u(12)}px ${u(20)}px`,
            borderLeft: `${u(5)}px solid ${theme.colors.accent}`,
            background: alpha("#000000", 0.38),
            borderRadius: `0 ${u(10)}px ${u(10)}px 0`,
          }}
        >
          {caption.text}
        </div>
      ) : null}
    </div>
  );
};

const FullBleed: React.FC<{ caption: CaptionSpec; muted?: boolean }> = ({ caption, muted = true }) => {
  const scene = useScene();
  if (!scene.visual) {
    return (
      <SceneShell center>
        <Heading text={caption?.title ?? caption?.text ?? ""} />
      </SceneShell>
    );
  }
  return (
    <AbsoluteFill>
      <Media visual={scene.visual} durationInFrames={scene.durationInFrames} seed={scene.index} muted={muted} />
      {/* Bottom scrim keeps captions and lower text readable on any image. */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 22%, transparent 55%, rgba(0,0,0,0.6) 100%)" }} />
      <MediaCaption caption={caption} />
      <Credit text={scene.visual.credit} />
    </AbsoluteFill>
  );
};

export const ImageScene: React.FC = () => {
  const d = useSceneData<SceneOf<"image">>();
  return <FullBleed caption={d.caption} />;
};

export const VideoScene: React.FC = () => {
  const d = useSceneData<SceneOf<"video">>();
  return <FullBleed caption={d.caption} muted={!d.keepAudio} />;
};
