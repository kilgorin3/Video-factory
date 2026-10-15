import type { Theme } from "../timeline/types";
import type { StyleSpec } from "./schema";

/**
 * Theme presets. Pick one in video.yaml (style.theme) and override any color or font.
 * Every preset was checked for >= 4.5:1 text contrast against its background.
 */
export const THEMES: Record<string, Theme> = {
  midnight: {
    name: "midnight",
    dark: true,
    colors: {
      background: "#0B1020",
      surface: "#151B34",
      primary: "#7C9CFF",
      accent: "#FFB86B",
      text: "#F4F6FF",
      muted: "#9AA4C8",
      success: "#4ADE80",
      danger: "#F87171",
    },
    fonts: { heading: "Space Grotesk", body: "Inter", mono: "JetBrains Mono" },
    motion: "smooth",
    background: "mesh",
    grain: true,
    radius: 28,
  },
  paper: {
    name: "paper",
    dark: false,
    colors: {
      background: "#F6F1E7",
      surface: "#FFFFFF",
      primary: "#1F3A5F",
      accent: "#E4572E",
      text: "#1A1A1A",
      muted: "#5F5A52",
      success: "#2E7D32",
      danger: "#C62828",
    },
    fonts: { heading: "Fraunces", body: "Inter", mono: "IBM Plex Mono" },
    motion: "calm",
    background: "gradient",
    grain: true,
    radius: 18,
  },
  chalkboard: {
    name: "chalkboard",
    dark: true,
    colors: {
      background: "#1E2B24",
      surface: "#263830",
      primary: "#F2E8CF",
      accent: "#F4D35E",
      text: "#F7F5EE",
      muted: "#A9B8AE",
      success: "#9BE7A0",
      danger: "#FF8A80",
    },
    fonts: { heading: "Lexend", body: "Lexend", mono: "JetBrains Mono" },
    motion: "calm",
    background: "grid",
    grain: true,
    radius: 14,
  },
  neon: {
    name: "neon",
    dark: true,
    colors: {
      background: "#07070C",
      surface: "#12121C",
      primary: "#00E5FF",
      accent: "#FF2BD6",
      text: "#FFFFFF",
      muted: "#8C8CA6",
      success: "#39FF14",
      danger: "#FF3B5C",
    },
    fonts: { heading: "Sora", body: "Inter", mono: "Space Mono" },
    motion: "snappy",
    background: "grid",
    grain: false,
    radius: 22,
  },
  sunrise: {
    name: "sunrise",
    dark: false,
    colors: {
      background: "#FFF7ED",
      surface: "#FFFFFF",
      primary: "#C2410C",
      accent: "#7C3AED",
      text: "#1C1917",
      muted: "#6B625C",
      success: "#15803D",
      danger: "#B91C1C",
    },
    fonts: { heading: "Outfit", body: "Outfit", mono: "JetBrains Mono" },
    motion: "smooth",
    background: "gradient",
    grain: false,
    radius: 26,
  },
  ocean: {
    name: "ocean",
    dark: true,
    colors: {
      background: "#04293A",
      surface: "#064663",
      primary: "#4FD1C5",
      accent: "#ECB365",
      text: "#F0FBFF",
      muted: "#9CC3D5",
      success: "#6EE7B7",
      danger: "#FCA5A5",
    },
    fonts: { heading: "Manrope", body: "Manrope", mono: "Fira Code" },
    motion: "smooth",
    background: "mesh",
    grain: true,
    radius: 24,
  },
  mono: {
    name: "mono",
    dark: true,
    colors: {
      background: "#0E0E0E",
      surface: "#1A1A1A",
      primary: "#FFFFFF",
      accent: "#FFD400",
      text: "#FAFAFA",
      muted: "#8A8A8A",
      success: "#A3E635",
      danger: "#FF5C5C",
    },
    fonts: { heading: "Archivo", body: "Inter", mono: "JetBrains Mono" },
    motion: "snappy",
    background: "solid",
    grain: true,
    radius: 8,
  },
  kids: {
    name: "kids",
    dark: false,
    colors: {
      background: "#FFFBEB",
      surface: "#FFFFFF",
      primary: "#2563EB",
      accent: "#E11D48",
      text: "#1E293B",
      muted: "#5B6B80",
      success: "#16A34A",
      danger: "#DC2626",
    },
    fonts: { heading: "Nunito", body: "Nunito", mono: "Fira Code" },
    motion: "snappy",
    background: "gradient",
    grain: false,
    radius: 32,
  },
};

export function resolveTheme(style: StyleSpec): Theme {
  const preset = THEMES[style.theme];
  if (!preset) {
    throw new Error(
      `Unknown theme "${style.theme}". Available: ${Object.keys(THEMES).join(", ")}`,
    );
  }
  const colors = { ...preset.colors, ...style.colors };
  return {
    ...preset,
    colors,
    dark: style.colors.background ? luminance(colors.background) < 0.4 : preset.dark,
    fonts: { ...preset.fonts, ...style.fonts },
    motion: style.motion ?? preset.motion,
    background: style.background ?? preset.background,
    grain: style.grain ?? preset.grain,
  };
}

/** Relative luminance (WCAG) of a hex color, 0..1. */
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
