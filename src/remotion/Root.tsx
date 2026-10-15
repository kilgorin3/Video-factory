import React from "react";
import { Composition, Still, type CalculateMetadataFunction } from "remotion";
import type { VideoProps } from "../timeline/types";
import { DEMO_TIMELINE } from "./demo";
import { Thumbnail } from "./Thumbnail";
import { VideoComposition } from "./Video";

const fromTimeline: CalculateMetadataFunction<VideoProps> = ({ props }) => ({
  durationInFrames: props.timeline.meta.durationInFrames,
  fps: props.timeline.meta.fps,
  width: props.timeline.meta.width,
  height: props.timeline.meta.height,
});

export const Root: React.FC = () => (
  <>
    <Composition
      id="Video"
      component={VideoComposition}
      defaultProps={{ timeline: DEMO_TIMELINE }}
      calculateMetadata={fromTimeline}
      durationInFrames={DEMO_TIMELINE.meta.durationInFrames}
      fps={30}
      width={1920}
      height={1080}
    />
    <Still id="Thumbnail" component={Thumbnail} defaultProps={{ timeline: DEMO_TIMELINE }} width={1280} height={720} />
  </>
);
