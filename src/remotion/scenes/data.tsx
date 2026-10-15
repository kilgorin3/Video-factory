import { evolvePath } from "@remotion/paths";
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import type { SceneOf } from "../../spec/schema";
import { Heading, SceneShell, useScene, useSceneData } from "../components/kit";
import { cueAt, enterStyle, progress, useEnter } from "../lib/anim";
import { alpha, mix, useLayout, useTheme } from "../theme";

const fmt = (n: number, decimals = 0) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);

// ---------------------------------------------------------------- stat

export const StatScene: React.FC = () => {
  const d = useSceneData<SceneOf<"stat">>();
  const scene = useScene();
  const frame = useCurrentFrame();
  const { theme, fonts, timeline } = useTheme();
  const { u, portrait } = useLayout();
  const c = theme.colors;
  const start = scene.narration?.start ?? 6;
  const p = progress(frame, start, timeline.meta.fps * 1.8, Easing.out(Easing.exp));
  const label = useEnter(start + 10);
  const ctx = useEnter(start + 22);
  const glow = progress(frame, start - 6, timeline.meta.fps * 1.2);
  const line = progress(frame, start + 8, timeline.meta.fps * 0.8);

  return (
    <SceneShell center>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "42%",
          width: u(900),
          height: u(900),
          transform: `translate(-50%, -50%) scale(${0.8 + 0.2 * glow})`,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${alpha(c.primary, 0.22 * glow)} 0%, transparent 62%)`,
        }}
      />
      <div style={{ position: "relative", textAlign: "center", maxWidth: "88%" }}>
        <div
          style={{
            fontFamily: fonts.heading,
            fontWeight: 800,
            fontSize: u(portrait ? 170 : 220),
            lineHeight: 1,
            letterSpacing: "-0.04em",
            background: `linear-gradient(135deg, ${c.primary}, ${c.accent})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontVariantNumeric: "tabular-nums",
            opacity: Math.min(1, p * 4),
          }}
        >
          {d.prefix}
          {fmt(d.value * p, d.decimals)}
          {d.suffix}
        </div>
        <div style={{ width: u(220) * line, height: u(6), borderRadius: u(3), background: c.accent, margin: `${u(26)}px auto 0` }} />
        <div style={{ ...enterStyle(label, u(20)), fontFamily: fonts.heading, fontWeight: 700, fontSize: u(54), color: c.text, marginTop: u(30) }}>
          {d.label}
        </div>
        {d.context ? (
          <div style={{ ...enterStyle(ctx, u(16)), fontFamily: fonts.body, fontSize: u(36), lineHeight: 1.4, color: c.muted, marginTop: u(18) }}>
            {d.context}
          </div>
        ) : null}
        {d.source ? (
          <div style={{ ...enterStyle(ctx, u(10)), fontFamily: fonts.body, fontSize: u(22), color: c.muted, marginTop: u(26), opacity: 0.8 }}>
            Source: {d.source}
          </div>
        ) : null}
      </div>
    </SceneShell>
  );
};

// ---------------------------------------------------------------- chart

function niceMax(v: number) {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const n = v / exp;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * exp;
}

function usePalette() {
  const { theme } = useTheme();
  const c = theme.colors;
  return [c.primary, c.accent, c.success, mix(c.primary, c.text, 0.45), c.danger, mix(c.accent, c.text, 0.4), c.muted];
}

export const ChartScene: React.FC = () => {
  const d = useSceneData<SceneOf<"chart">>();
  const { theme, fonts } = useTheme();
  const { u } = useLayout();
  const foot = useEnter(20);
  return (
    <SceneShell>
      {d.title ? <Heading text={d.title} size={62} /> : null}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {d.chart === "bar" ? <BarChart /> : d.chart === "line" ? <LineChart /> : <DonutChart />}
      </div>
      {d.source ? (
        <div style={{ ...enterStyle(foot, u(8)), fontFamily: fonts.body, fontSize: u(22), color: theme.colors.muted, marginTop: u(16) }}>
          Source: {d.source}
        </div>
      ) : null}
    </SceneShell>
  );
};

const BarChart: React.FC = () => {
  const d = useSceneData<SceneOf<"chart">>();
  const scene = useScene();
  const frame = useCurrentFrame();
  const { theme, fonts } = useTheme();
  const { u, portrait } = useLayout();
  const c = theme.colors;
  const max = niceMax(Math.max(...d.data.map((x) => x.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const grid = useEnter(0);
  const labelSize = u(d.data.length > 7 || portrait ? 24 : 30);

  return (
    <div style={{ flex: 1, display: "flex", gap: u(20) }}>
      <div style={{ display: "flex", flexDirection: "column-reverse", justifyContent: "space-between", paddingBottom: u(64), opacity: grid }}>
        {ticks.map((t) => (
          <div key={t} style={{ fontFamily: fonts.mono, fontSize: u(22), color: c.muted, height: 0, lineHeight: 0 }}>
            {fmt(max * t, Number.isInteger(max * t) ? 0 : 1)}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, position: "relative" }}>
          {ticks.map((t) => (
            <div
              key={t}
              style={{ position: "absolute", left: 0, right: 0, bottom: `${t * 100}%`, height: 1, background: alpha(c.text, t === 0 ? 0.3 : 0.08), opacity: grid }}
            />
          ))}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: u(d.data.length > 6 ? 18 : 34), padding: `0 ${u(16)}px` }}>
            {d.data.map((x, i) => {
              const at = cueAt(scene.cues, x.cue, 10 + i * 8);
              const p = progress(frame, at, 26, Easing.out(Easing.cubic));
              const hot = d.highlight === x.label;
              const color = x.color ?? (d.highlight ? (hot ? c.accent : alpha(c.primary, 0.75)) : c.primary);
              return (
                <div key={i} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
                  <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: labelSize * 1.15, color: hot ? c.accent : c.text, opacity: p, marginBottom: u(10), fontVariantNumeric: "tabular-nums" }}>
                    {fmt(x.value * p, Number.isInteger(x.value) ? 0 : 1)}
                    {d.unit}
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: `${(Math.max(0, x.value) / max) * 100 * p}%`,
                      borderRadius: `${u(12)}px ${u(12)}px 0 0`,
                      background: `linear-gradient(180deg, ${color}, ${alpha(color.startsWith("#") ? color : c.primary, 0.55)})`,
                      boxShadow: hot ? `0 0 ${u(40)}px ${alpha(c.accent, 0.45)}` : undefined,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: u(d.data.length > 6 ? 18 : 34), padding: `${u(16)}px ${u(16)}px 0`, height: u(64) }}>
          {d.data.map((x, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontFamily: fonts.body, fontSize: labelSize, color: c.muted, opacity: grid, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              {x.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** Catmull-Rom spline through points, as an SVG path. */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let dStr = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    dStr += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  return dStr;
}

const LineChart: React.FC = () => {
  const d = useSceneData<SceneOf<"chart">>();
  const scene = useScene();
  const frame = useCurrentFrame();
  const { theme, fonts } = useTheme();
  const { u, width, height, padX, padTop, padBottom } = useLayout();
  const c = theme.colors;
  // Draw in real pixels so strokes stay round and labels line up with points.
  const W = width - padX * 2;
  const H = Math.max(u(280), height - padTop - padBottom - (d.title ? u(190) : 0) - u(80) - (d.source ? u(44) : 0));
  const pad = u(24);
  const max = niceMax(Math.max(...d.data.map((x) => x.value)));
  const pts: [number, number][] = d.data.map((x, i) => [
    pad + (i / Math.max(1, d.data.length - 1)) * (W - pad * 2),
    H - pad - (x.value / max) * (H - pad * 2),
  ]);
  const path = smoothPath(pts);
  // The line reaches point i exactly at its cue.
  const times = d.data.map((x, i) => cueAt(scene.cues, x.cue, 10 + i * 10));
  const mono = times.map((t, i) => t + i * 0.001);
  const drawn =
    d.data.length < 2
      ? 1
      : interpolate(frame, mono, d.data.map((_, i) => i / (d.data.length - 1)), { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lead = interpolate(frame, [times[0] - 12, times[0]], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const evolved = evolvePath(Math.min(1, drawn + 0.0001) * lead, path);
  const area = `${path} L ${pts[pts.length - 1][0]} ${H - pad} L ${pts[0][0]} ${H - pad} Z`;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.primary} stopOpacity={0.35} />
            <stop offset="1" stopColor={c.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={pad} x2={W - pad} y1={H - pad - t * (H - pad * 2)} y2={H - pad - t * (H - pad * 2)} stroke={alpha(c.text, 0.08)} strokeWidth={1} />
        ))}
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke={alpha(c.text, 0.3)} strokeWidth={1} />
        <path d={area} fill="url(#area)" opacity={drawn} />
        <path
          d={path}
          fill="none"
          stroke={c.primary}
          strokeWidth={u(6)}
          strokeLinecap="round"
          strokeDasharray={evolved.strokeDasharray}
          strokeDashoffset={evolved.strokeDashoffset}
        />
        {pts.map(([x, y], i) => {
          const p = progress(frame, times[i], 10, Easing.out(Easing.back(2)));
          const hot = d.highlight === d.data[i].label;
          return (
            <circle key={i} cx={x} cy={y} r={u(hot ? 13 : 10) * p} fill={c.background} stroke={hot ? c.accent : c.primary} strokeWidth={u(5)} />
          );
        })}
      </svg>
      <div style={{ position: "relative", width: W, height: u(70) }}>
        {d.data.map((x, i) => {
          const p = progress(frame, times[i], 12);
          const hot = d.highlight === x.label;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${(pts[i][0] / W) * 100}%`,
                transform: "translateX(-50%)",
                textAlign: "center",
                fontFamily: fonts.body,
                fontSize: u(24),
                color: hot ? c.accent : c.muted,
                opacity: Math.max(0.35, p),
                whiteSpace: "nowrap",
                paddingTop: u(10),
              }}
            >
              <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: u(30), color: hot ? c.accent : c.text, opacity: p }}>
                {fmt(x.value, Number.isInteger(x.value) ? 0 : 1)}
                {d.unit}
              </div>
              {x.label}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DonutChart: React.FC = () => {
  const d = useSceneData<SceneOf<"chart">>();
  const scene = useScene();
  const frame = useCurrentFrame();
  const { theme, fonts } = useTheme();
  const { u, portrait } = useLayout();
  const palette = usePalette();
  const c = theme.colors;
  const total = d.data.reduce((a, x) => a + Math.max(0, x.value), 0) || 1;
  const R = 200;
  const SW = 70;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const hot = d.data.find((x) => x.label === d.highlight) ?? d.data[0];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: portrait ? "column" : "row", alignItems: "center", justifyContent: "center", gap: u(90) }}>
      <div style={{ position: "relative", width: u(560), height: u(560) }}>
        <svg viewBox="0 0 560 560" width="100%" height="100%" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={280} cy={280} r={R} fill="none" stroke={alpha(c.text, 0.07)} strokeWidth={SW} />
          {d.data.map((x, i) => {
            const frac = Math.max(0, x.value) / total;
            const at = cueAt(scene.cues, x.cue, 8 + i * 8);
            const p = progress(frame, at, 22, Easing.inOut(Easing.cubic));
            const seg = (
              <circle
                key={i}
                cx={280}
                cy={280}
                r={R}
                fill="none"
                stroke={x.color ?? palette[i % palette.length]}
                strokeWidth={SW}
                strokeDasharray={`${Math.max(0, frac * C * p - 4)} ${C}`}
                strokeDashoffset={-acc * C}
              />
            );
            acc += frac;
            return seg;
          })}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: u(84), color: c.text }}>
            {Math.round((Math.max(0, hot.value) / total) * 100)}%
          </div>
          <div style={{ fontFamily: fonts.body, fontSize: u(28), color: c.muted }}>{hot.label}</div>
        </div>
      </div>
      <div>
        {d.data.map((x, i) => {
          const at = cueAt(scene.cues, x.cue, 8 + i * 8);
          const p = progress(frame, at, 14);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: u(18), marginBottom: u(22), opacity: Math.max(0.25, p), fontFamily: fonts.body, fontSize: u(36), color: c.text }}>
              <div style={{ width: u(26), height: u(26), borderRadius: u(7), background: x.color ?? palette[i % palette.length] }} />
              <span style={{ fontWeight: 600 }}>{x.label}</span>
              <span style={{ color: c.muted, fontFamily: fonts.mono, fontSize: u(30) }}>
                {fmt(x.value, Number.isInteger(x.value) ? 0 : 1)}
                {d.unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
