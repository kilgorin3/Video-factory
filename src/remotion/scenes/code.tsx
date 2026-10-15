import { Highlight, themes } from "prism-react-renderer";
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { SceneOf } from "../../spec/schema";
import { SceneShell, useScene, useSceneData } from "../components/kit";
import { cueAt, enterStyle, useEnter } from "../lib/anim";
import { alpha, useLayout, useTheme } from "../theme";

/** "3-5, 7" -> Set{3,4,5,7} (1-based line numbers). */
export function parseLines(spec: string): Set<number> {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const [a, b] = part.trim().split("-").map(Number);
    if (!Number.isFinite(a)) continue;
    for (let i = a; i <= (Number.isFinite(b) ? b : a); i++) out.add(i);
  }
  return out;
}

export const CodeScene: React.FC = () => {
  const d = useSceneData<SceneOf<"code">>();
  const scene = useScene();
  const frame = useCurrentFrame();
  const { theme, fonts } = useTheme();
  const { u } = useLayout();
  const win = useEnter(0, { slower: true });
  const code = d.code.replace(/\s+$/, "");
  const lineCount = code.split("\n").length;
  const size = lineCount <= 12 ? 36 : lineCount <= 18 ? 30 : lineCount <= 24 ? 25 : 21;

  // Active highlight = the latest one whose cue has fired.
  const marks = d.highlights.map((h, i) => ({ lines: parseLines(h.lines), at: cueAt(scene.cues, h.cue, 30 + i * 40) }));
  const active = [...marks].reverse().find((m) => frame >= m.at);
  const focusP = active ? interpolate(frame, [active.at, active.at + 8], [0, 1], { extrapolateRight: "clamp" }) : 0;

  return (
    <SceneShell center>
      <div
        style={{
          width: "100%",
          maxWidth: u(1500),
          borderRadius: u(22),
          overflow: "hidden",
          background: theme.dark ? "#1E222A" : "#FAFAFA",
          border: `1px solid ${alpha(theme.colors.text, 0.1)}`,
          boxShadow: `0 ${u(30)}px ${u(80)}px ${alpha("#000000", theme.dark ? 0.5 : 0.18)}`,
          ...enterStyle(win, u(40), 0),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: u(12), padding: `${u(18)}px ${u(24)}px`, background: alpha(theme.colors.text, 0.05) }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <div key={c} style={{ width: u(16), height: u(16), borderRadius: "50%", background: c }} />
          ))}
          <div style={{ marginLeft: u(16), fontFamily: fonts.mono, fontSize: u(22), color: theme.colors.muted }}>{d.title ?? d.language}</div>
        </div>
        <Highlight theme={theme.dark ? themes.oneDark : themes.oneLight} code={code} language={d.language}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre style={{ margin: 0, padding: `${u(26)}px ${u(10)}px`, fontFamily: fonts.mono, fontSize: u(size), lineHeight: 1.55, background: "transparent" }}>
              {tokens.map((line, i) => {
                const n = i + 1;
                const reveal = interpolate(frame, [6 + i * 2, 12 + i * 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                const on = active?.lines.has(n);
                const opacity = reveal * (active ? (on ? 1 : 1 - 0.62 * focusP) : 1);
                const { style: lineStyle, ...lineProps } = getLineProps({ line });
                return (
                  <div
                    key={i}
                    {...lineProps}
                    style={{
                      ...lineStyle,
                      display: "flex",
                      opacity,
                      transform: `translateX(${(1 - reveal) * u(20)}px)`,
                      background: on ? alpha(theme.colors.primary, 0.16 * focusP) : undefined,
                      borderLeft: `${u(5)}px solid ${on ? alpha(theme.colors.accent, focusP) : "transparent"}`,
                      paddingLeft: u(16),
                    }}
                  >
                    <span style={{ width: u(size * 1.6), flex: "none", color: alpha(theme.colors.muted, 0.6), userSelect: "none" }}>{n}</span>
                    <span>
                      {line.map((token, k) => (
                        <span key={k} {...getTokenProps({ token })} />
                      ))}
                    </span>
                  </div>
                );
              })}
            </pre>
          )}
        </Highlight>
      </div>
    </SceneShell>
  );
};
