import type React from "react";
import type { SceneType } from "../../spec/schema";
import { CodeScene } from "./code";
import { ChartScene, StatScene } from "./data";
import { ComparisonScene, StepsScene, TimelineScene } from "./diagram";
import { ImageScene, VideoScene } from "./media";
import {
  BulletsScene,
  ChapterScene,
  DefinitionScene,
  KineticScene,
  OutroScene,
  QuoteScene,
  SplitScene,
  TitleScene,
} from "./text";

/** Scene type -> component. Add a template: write a component, register it here and in spec/schema.ts. */
export const SCENES: Record<SceneType, React.FC> = {
  title: TitleScene,
  chapter: ChapterScene,
  bullets: BulletsScene,
  image: ImageScene,
  video: VideoScene,
  split: SplitScene,
  quote: QuoteScene,
  stat: StatScene,
  chart: ChartScene,
  steps: StepsScene,
  timeline: TimelineScene,
  comparison: ComparisonScene,
  code: CodeScene,
  definition: DefinitionScene,
  kinetic: KineticScene,
  outro: OutroScene,
};
