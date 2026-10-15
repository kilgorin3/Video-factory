import { linearTiming, type TransitionPresentation, type TransitionPresentationComponentProps } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import type { TransitionType } from "../../spec/schema";

type ZoomProps = Record<string, unknown>;

/** Incoming scene scales down into place while the outgoing one recedes. */
const Zoom: React.FC<TransitionPresentationComponentProps<ZoomProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
}) => {
  const p = presentationProgress;
  const style: React.CSSProperties =
    presentationDirection === "entering"
      ? { opacity: p, transform: `scale(${1.08 - 0.08 * p})`, filter: `blur(${(1 - p) * 6}px)` }
      : { opacity: 1 - p, transform: `scale(${1 - 0.05 * p})` };
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

const zoom = (): TransitionPresentation<ZoomProps> => ({ component: Zoom, props: {} });

export function presentationFor(type: TransitionType, seed: number): TransitionPresentation<Record<string, unknown>> {
  switch (type) {
    case "slide":
      return slide({ direction: seed % 2 ? "from-right" : "from-bottom" }) as TransitionPresentation<Record<string, unknown>>;
    case "wipe":
      return wipe({ direction: "from-left" }) as TransitionPresentation<Record<string, unknown>>;
    case "zoom":
      return zoom() as TransitionPresentation<Record<string, unknown>>;
    default:
      return fade({ shouldFadeOutExitingScene: true }) as TransitionPresentation<Record<string, unknown>>;
  }
}

export function timingFor(durationInFrames: number) {
  return linearTiming({ durationInFrames, easing: Easing.inOut(Easing.cubic) });
}
