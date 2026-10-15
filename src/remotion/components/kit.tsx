import React, { createContext, useContext } from "react";
import { AbsoluteFill } from "remotion";
import type { TimelineScene } from "../../timeline/types";
import { enterStyle, useEnter } from "../lib/anim";
import { alpha, useLayout, useTheme } from "../theme";
import { Media } from "./Media";

export const SceneContext = createContext<TimelineScene | null>(null);

export function useScene() {
  const s = useContext(SceneContext);
  if (!s) throw new Error("useScene outside a scene");
  return s;
}

/** Typed access to the scene's spec fields. */
export function useSceneData<T>() {
  return useScene().data as T;
}

/**
 * Wraps scene content: optional per-scene background (a color or the scene's
 * visual as a full-bleed backdrop), then a padded content area that stays
 * clear of the caption band.
 */
export const SceneShell: React.FC<{
  children: React.ReactNode;
  center?: boolean;
  style?: React.CSSProperties;
}> = ({ children, center, style }) => {
  const scene = useScene();
  const { theme } = useTheme();
  const { padX, padTop, padBottom } = useLayout();
  const bg = scene.background;
  const visualBg = bg === "visual" && scene.visual;

  return (
    <AbsoluteFill>
      {bg && bg.startsWith("#") ? <AbsoluteFill style={{ background: bg }} /> : null}
      {visualBg ? (
        <>
          <Media visual={scene.visual!} durationInFrames={scene.durationInFrames} seed={scene.index} />
          <AbsoluteFill
            style={{
              background: `linear-gradient(180deg, ${alpha(theme.colors.background, 0.55)} 0%, ${alpha(theme.colors.background, 0.82)} 100%)`,
            }}
          />
        </>
      ) : null}
      <AbsoluteFill
        style={{
          padding: `${padTop}px ${padX}px ${padBottom}px`,
          justifyContent: center ? "center" : "flex-start",
          alignItems: center ? "center" : "stretch",
          ...style,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Heading: React.FC<{ text: string; delay?: number; size?: number; maxWidth?: string }> = ({
  text,
  delay = 0,
  size = 72,
  maxWidth,
}) => {
  const { theme, fonts } = useTheme();
  const { u } = useLayout();
  const p = useEnter(delay);
  const bar = useEnter(delay + 6);
  return (
    <div style={{ marginBottom: u(44), maxWidth }}>
      <div
        style={{
          width: u(84) * bar,
          height: u(8),
          borderRadius: u(4),
          background: theme.colors.accent,
          marginBottom: u(22),
        }}
      />
      <div
        style={{
          fontFamily: fonts.heading,
          fontWeight: 700,
          fontSize: u(fitSize(text, size)),
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          color: theme.colors.text,
          ...enterStyle(p, u(30)),
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** Shrink long headings so they stay on one or two lines. */
export function fitSize(text: string, base: number) {
  const n = text.length;
  if (n > 70) return base * 0.66;
  if (n > 48) return base * 0.8;
  if (n > 32) return base * 0.9;
  return base;
}

/** Words that rise in one after another. */
export const StaggerWords: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  style?: React.CSSProperties;
  highlight?: string[];
}> = ({ text, delay = 0, stagger = 3, style, highlight = [] }) => {
  const { theme } = useTheme();
  const words = text.split(/\s+/).filter(Boolean);
  const hl = new Set(highlight.map((h) => h.toLowerCase()));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: "0.26em", ...style }}>
      {words.map((w, i) => (
        <Word key={i} delay={delay + i * stagger} color={hl.has(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")) ? theme.colors.accent : undefined}>
          {w}
        </Word>
      ))}
    </div>
  );
};

const Word: React.FC<{ delay: number; children: React.ReactNode; color?: string }> = ({ delay, children, color }) => {
  const p = useEnter(delay);
  const { u } = useLayout();
  return <span style={{ display: "inline-block", color, ...enterStyle(p, u(36), 14) }}>{children}</span>;
};

export const Pill: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({
  children,
  color,
  style,
}) => {
  const { theme, fonts } = useTheme();
  const { u } = useLayout();
  const c = color ?? theme.colors.accent;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `${u(10)}px ${u(22)}px`,
        borderRadius: 999,
        background: alpha(c, 0.14),
        border: `1px solid ${alpha(c, 0.35)}`,
        color: c,
        fontFamily: fonts.body,
        fontWeight: 700,
        fontSize: u(24),
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; tone?: string }> = ({
  children,
  style,
  tone,
}) => {
  const { theme } = useTheme();
  const { u } = useLayout();
  return (
    <div
      style={{
        background: theme.dark ? alpha(theme.colors.surface, 0.78) : theme.colors.surface,
        border: `1px solid ${tone ? alpha(tone, 0.45) : alpha(theme.colors.text, theme.dark ? 0.1 : 0.08)}`,
        borderRadius: u(theme.radius),
        boxShadow: `0 ${u(18)}px ${u(50)}px ${alpha("#000000", theme.dark ? 0.35 : 0.1)}`,
        padding: u(36),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Scene visual framed as a rounded card (for split layouts). */
export const ImageCard: React.FC<{ style?: React.CSSProperties; delay?: number }> = ({ style, delay = 4 }) => {
  const scene = useScene();
  const { theme } = useTheme();
  const { u } = useLayout();
  const p = useEnter(delay, { slower: true });
  if (!scene.visual) return null;
  return (
    <div
      style={{
        position: "relative",
        borderRadius: u(theme.radius),
        overflow: "hidden",
        boxShadow: `0 ${u(24)}px ${u(70)}px ${alpha("#000000", theme.dark ? 0.5 : 0.18)}`,
        border: `1px solid ${alpha(theme.colors.text, 0.08)}`,
        opacity: Math.min(1, p * 1.3),
        transform: `scale(${0.94 + 0.06 * p})`,
        ...style,
      }}
    >
      <Media visual={scene.visual} durationInFrames={scene.durationInFrames} seed={scene.index} />
    </div>
  );
};

export const Marker: React.FC<{ n?: number; color?: string; size?: number; symbol?: string }> = ({
  n,
  color,
  size = 54,
  symbol,
}) => {
  const { theme, fonts } = useTheme();
  const { u } = useLayout();
  const c = color ?? theme.colors.primary;
  const label = symbol ?? (n !== undefined ? String(n) : "");
  return (
    <div
      style={{
        flex: "none",
        width: u(size),
        height: u(size),
        borderRadius: label ? u(size * 0.32) : "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: label ? alpha(c, 0.16) : "transparent",
        border: `${u(3)}px solid ${c}`,
        color: c,
        fontFamily: fonts.mono,
        fontWeight: 700,
        fontSize: u(size * 0.46),
        transform: label ? undefined : `scale(0.42)`,
      }}
    >
      {label}
    </div>
  );
};
