import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, mix, useLayout, useTheme } from "../theme";

/**
 * One continuous background under every scene, so transitions never flash
 * and the whole video feels like one designed piece.
 */
export const Background: React.FC = () => {
  const { theme } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, width, height } = useLayout();
  const t = frame / fps;
  const c = theme.colors;
  const base: React.CSSProperties = { backgroundColor: c.background };

  if (theme.background === "solid") {
    return <AbsoluteFill style={{ ...base, ...vignette(theme.dark) }} />;
  }

  if (theme.background === "grid") {
    const cell = u(72);
    const line = alpha(c.text, theme.dark ? 0.05 : 0.07);
    return (
      <AbsoluteFill style={base}>
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
            backgroundSize: `${cell}px ${cell}px`,
            backgroundPosition: `${(t * u(6)) % cell}px ${(t * u(4)) % cell}px`,
          }}
        />
        <AbsoluteFill
          style={{
            background: `radial-gradient(60% 60% at 30% 25%, ${alpha(c.primary, 0.14)}, transparent 70%)`,
          }}
        />
        <AbsoluteFill style={vignette(theme.dark)} />
      </AbsoluteFill>
    );
  }

  if (theme.background === "mesh") {
    const blob = (color: string, x: number, y: number, size: number, phase: number) => {
      const dx = Math.sin(t * 0.18 + phase) * width * 0.06;
      const dy = Math.cos(t * 0.14 + phase) * height * 0.06;
      return (
        <div
          style={{
            position: "absolute",
            left: x * width + dx - (size * width) / 2,
            top: y * height + dy - (size * width) / 2,
            width: size * width,
            height: size * width,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
          }}
        />
      );
    };
    return (
      <AbsoluteFill style={{ ...base, overflow: "hidden" }}>
        {blob(alpha(c.primary, theme.dark ? 0.32 : 0.22), 0.18, 0.2, 0.75, 0)}
        {blob(alpha(c.accent, theme.dark ? 0.2 : 0.18), 0.88, 0.85, 0.7, 2)}
        {blob(alpha(c.surface, 0.9), 0.65, 0.3, 0.6, 4)}
        <AbsoluteFill style={vignette(theme.dark)} />
      </AbsoluteFill>
    );
  }

  // gradient
  const angle = 135 + Math.sin(t * 0.1) * 8;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${angle}deg, ${c.background} 0%, ${mix(c.background, c.primary, theme.dark ? 0.12 : 0.07)} 55%, ${mix(c.background, c.accent, theme.dark ? 0.1 : 0.08)} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(50% 50% at ${70 + Math.sin(t * 0.2) * 6}% 20%, ${alpha(c.primary, 0.12)}, transparent 70%)`,
        }}
      />
      <AbsoluteFill style={vignette(theme.dark)} />
    </AbsoluteFill>
  );
};

function vignette(dark: boolean): React.CSSProperties {
  return {
    background: `radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,${dark ? 0.45 : 0.08}) 100%)`,
  };
}

/** Animated film grain. Subtle, but it kills banding in gradients after YouTube compression. */
export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const { theme } = useTheme();
  if (!theme.grain) return null;
  const seed = Math.floor(frame / 2) % 12;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: theme.dark ? "overlay" : "multiply", opacity: theme.dark ? 0.16 : 0.1 }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};
