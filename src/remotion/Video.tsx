import { TransitionSeries } from "@remotion/transitions";
import React from "react";
import { AbsoluteFill, Html5Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { Timeline, VideoProps } from "../timeline/types";
import { Background, Grain } from "./components/Background";
import { Captions } from "./components/Captions";
import { ChapterLabel, Logo, ProgressBar } from "./components/Chrome";
import { SceneContext } from "./components/kit";
import { presentationFor, timingFor } from "./lib/transitions";
import { SCENES } from "./scenes";
import { ThemeProvider, useTheme } from "./theme";

export const VideoComposition: React.FC<VideoProps> = ({ timeline }) => {
  return (
    <ThemeProvider timeline={timeline}>
      <AbsoluteFill style={{ backgroundColor: timeline.theme.colors.background }}>
        <Background />
        <TransitionSeries>
          {timeline.scenes.flatMap((scene, i) => {
            const Scene = SCENES[scene.type];
            const items: React.ReactNode[] = [];
            if (i > 0 && scene.transition) {
              items.push(
                <TransitionSeries.Transition
                  key={`t-${scene.id}`}
                  presentation={presentationFor(scene.transition.type, i)}
                  timing={timingFor(scene.transition.durationInFrames)}
                />,
              );
            }
            items.push(
              <TransitionSeries.Sequence key={`s-${scene.id}`} durationInFrames={scene.durationInFrames} name={`${i + 1}. ${scene.type}`}>
                <SceneContext.Provider value={scene}>
                  <Scene />
                </SceneContext.Provider>
              </TransitionSeries.Sequence>,
            );
            return items;
          })}
        </TransitionSeries>
        <ChapterOverlay />
        <Logo />
        <ProgressBar />
        <Captions />
        <Grain />
        <AudioLayer timeline={timeline} />
      </AbsoluteFill>
    </ThemeProvider>
  );
};

const NO_LABEL = new Set(["title", "chapter", "outro", "image", "video", "kinetic"]);

const ChapterOverlay: React.FC = () => {
  const { timeline } = useTheme();
  const frame = useCurrentFrame();
  let current = timeline.scenes[0];
  for (const s of timeline.scenes) if (s.startFrame <= frame) current = s;
  if (!current || NO_LABEL.has(current.type) || !current.chapterContext) return null;
  const chapters = timeline.chapters.filter((c) => c.title !== "Intro");
  const idx = chapters.findIndex((c) => c.title === current.chapterContext);
  const startedAt = Math.max(chapters[idx]?.startFrame ?? current.startFrame, current.startFrame);
  return <ChapterLabel title={current.chapterContext} number={idx + 1} startedAt={startedAt} />;
};

/** Music sits under narration and dips ("ducks") whenever someone is talking. */
function musicVolume(timeline: Timeline, f: number) {
  const m = timeline.audio.music!;
  const fps = timeline.meta.fps;
  const total = timeline.meta.durationInFrames;
  const attack = Math.round(fps * 0.25);
  const release = Math.round(fps * 0.6);
  let duck = 0;
  for (const w of timeline.audio.speech) {
    if (f < w.start - attack || f > w.end + release) continue;
    const d =
      f < w.start ? (f - (w.start - attack)) / attack : f > w.end ? 1 - (f - w.end) / release : 1;
    duck = Math.max(duck, d);
    if (duck >= 1) break;
  }
  const level = m.volume + (m.duckTo - m.volume) * duck;
  const fades = interpolate(f, [0, fps * 1.5, total - fps * 2.5, total], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return level * fades;
}

const AudioLayer: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const { narration, music, sfx } = timeline.audio;
  return (
    <>
      {narration.map((n) => (
        <Sequence key={`n-${n.scene}`} from={n.startFrame} durationInFrames={n.durationInFrames + 3} layout="none" name={`voice ${n.scene + 1}`}>
          <Html5Audio src={staticFile(n.src)} />
        </Sequence>
      ))}
      {music ? (
        <Html5Audio
          src={staticFile(music.src)}
          loop
          loopVolumeCurveBehavior="extend"
          volume={(f) => musicVolume(timeline, f)}
        />
      ) : null}
      {sfx.map((s, i) => (
        <Sequence key={`fx-${i}`} from={s.frame} layout="none" name="sfx">
          <Html5Audio src={staticFile(s.src)} volume={Math.min(1, s.volume)} />
        </Sequence>
      ))}
    </>
  );
};
