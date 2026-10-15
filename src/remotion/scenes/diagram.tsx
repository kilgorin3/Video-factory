import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { SceneOf } from "../../spec/schema";
import { Card, Heading, Marker, SceneShell, useScene, useSceneData } from "../components/kit";
import { cueAt, enterFromLeft, enterStyle, progress, useEnter } from "../lib/anim";
import { alpha, useLayout, useTheme } from "../theme";

// ---------------------------------------------------------------- steps

const Arrow: React.FC<{ p: number; vertical?: boolean }> = ({ p, vertical }) => {
  const { theme } = useTheme();
  const { u } = useLayout();
  const len = u(vertical ? 46 : 64);
  const c = theme.colors.primary;
  return (
    <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: vertical ? "100%" : len, height: vertical ? len : "auto" }}>
      <svg width={vertical ? u(30) : len} height={vertical ? len : u(30)} style={{ overflow: "visible" }}>
        {vertical ? (
          <>
            <line x1={u(15)} y1={0} x2={u(15)} y2={len * p} stroke={c} strokeWidth={u(4)} strokeLinecap="round" />
            <path d={`M ${u(5)} ${len - u(12)} L ${u(15)} ${len} L ${u(25)} ${len - u(12)}`} fill="none" stroke={c} strokeWidth={u(4)} strokeLinecap="round" opacity={p > 0.85 ? 1 : 0} />
          </>
        ) : (
          <>
            <line x1={0} y1={u(15)} x2={len * p} y2={u(15)} stroke={c} strokeWidth={u(4)} strokeLinecap="round" />
            <path d={`M ${len - u(12)} ${u(5)} L ${len} ${u(15)} L ${len - u(12)} ${u(25)}`} fill="none" stroke={c} strokeWidth={u(4)} strokeLinecap="round" opacity={p > 0.85 ? 1 : 0} />
          </>
        )}
      </svg>
    </div>
  );
};

const StepCard: React.FC<{ step: SceneOf<"steps">["steps"][number]; i: number; at: number; activeUntil: number; compact: boolean }> = ({
  step,
  i,
  at,
  activeUntil,
  compact,
}) => {
  const { theme, fonts } = useTheme();
  const { u } = useLayout();
  const frame = useCurrentFrame();
  const p = useEnter(at);
  const active = frame >= at && frame < activeUntil;
  return (
    <Card
      tone={active ? theme.colors.primary : undefined}
      style={{
        flex: 1,
        minWidth: 0,
        padding: u(compact ? 26 : 34),
        ...enterStyle(p, u(36)),
        opacity: Math.min(1, p * 1.4) * (frame >= activeUntil ? 0.7 : 1),
      }}
    >
      <Marker n={i + 1} size={60} color={active ? theme.colors.accent : theme.colors.primary} />
      <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: u(compact ? 36 : 44), color: theme.colors.text, margin: `${u(24)}px 0 ${u(14)}px`, lineHeight: 1.12 }}>
        {step.title}
      </div>
      {step.text ? (
        <div style={{ fontFamily: fonts.body, fontSize: u(compact ? 27 : 31), lineHeight: 1.4, color: theme.colors.muted }}>{step.text}</div>
      ) : null}
    </Card>
  );
};

export const StepsScene: React.FC = () => {
  const d = useSceneData<SceneOf<"steps">>();
  const scene = useScene();
  const frame = useCurrentFrame();
  const { portrait } = useLayout();
  const times = d.steps.map((s, i) => cueAt(scene.cues, s.cue, 12 + i * 18));
  const compact = d.steps.length > 4;
  return (
    <SceneShell>
      {d.heading ? <Heading text={d.heading} size={64} /> : null}
      <div style={{ flex: 1, display: "flex", flexDirection: portrait ? "column" : "row", alignItems: portrait ? "stretch" : "center" }}>
        {d.steps.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <Arrow vertical={portrait} p={progress(frame, times[i] - 10, 10)} /> : null}
            <StepCard step={s} i={i} at={times[i]} activeUntil={times[i + 1] ?? Infinity} compact={compact} />
          </React.Fragment>
        ))}
      </div>
    </SceneShell>
  );
};

// ---------------------------------------------------------------- timeline

export const TimelineScene: React.FC = () => {
  const d = useSceneData<SceneOf<"timeline">>();
  const scene = useScene();
  const frame = useCurrentFrame();
  const { theme } = useTheme();
  const { u, portrait } = useLayout();
  const c = theme.colors;
  const n = d.events.length;
  const times = d.events.map((e, i) => cueAt(scene.cues, e.cue, 12 + i * 16));
  const mono = times.map((t, i) => t + i * 0.001);
  const line =
    n < 2 ? 1 : interpolate(frame, [mono[0] - 10, ...mono], [0, ...d.events.map((_, i) => (i + 0.5) / n)], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const finalLine = interpolate(frame, [times[n - 1] + 8, times[n - 1] + 30], [0, 1 - (n - 0.5) / n], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  if (portrait) {
    return (
      <SceneShell>
        {d.heading ? <Heading text={d.heading} size={64} /> : null}
        <div style={{ position: "relative", flex: 1, paddingLeft: u(70) }}>
          <div style={{ position: "absolute", left: u(22), top: 0, width: u(5), height: `${(line + finalLine) * 100}%`, background: c.primary, borderRadius: u(3) }} />
          {d.events.map((e, i) => (
            <TimelineEvent key={i} e={e} at={times[i]} vertical />
          ))}
        </div>
      </SceneShell>
    );
  }

  return (
    <SceneShell>
      {d.heading ? <Heading text={d.heading} size={64} /> : null}
      <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: "38%", height: u(5), background: alpha(c.text, 0.08), borderRadius: u(3) }} />
        <div style={{ position: "absolute", left: 0, top: "38%", height: u(5), width: `${(line + finalLine) * 100}%`, background: `linear-gradient(90deg, ${c.primary}, ${c.accent})`, borderRadius: u(3) }} />
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          {d.events.map((e, i) => (
            <div key={i} style={{ flex: 1, position: "relative" }}>
              <TimelineEvent e={e} at={times[i]} />
            </div>
          ))}
        </div>
      </div>
    </SceneShell>
  );
};

const TimelineEvent: React.FC<{ e: SceneOf<"timeline">["events"][number]; at: number; vertical?: boolean }> = ({ e, at, vertical }) => {
  const { theme, fonts } = useTheme();
  const { u } = useLayout();
  const p = useEnter(at);
  const c = theme.colors;
  const dot = (
    <div
      style={{
        width: u(30),
        height: u(30),
        borderRadius: "50%",
        background: c.background,
        border: `${u(6)}px solid ${c.accent}`,
        transform: `scale(${p})`,
        boxShadow: `0 0 ${u(24)}px ${alpha(c.accent, 0.5 * p)}`,
      }}
    />
  );
  if (vertical) {
    return (
      <div style={{ position: "relative", marginBottom: u(46), ...enterFromLeft(p, u(30)) }}>
        <div style={{ position: "absolute", left: -u(62), top: u(6) }}>{dot}</div>
        <div style={{ fontFamily: fonts.mono, fontSize: u(30), color: c.accent, fontWeight: 700 }}>{e.date}</div>
        <div style={{ fontFamily: fonts.heading, fontSize: u(40), color: c.text, fontWeight: 700, margin: `${u(6)}px 0` }}>{e.title}</div>
        {e.text ? <div style={{ fontFamily: fonts.body, fontSize: u(30), color: c.muted, lineHeight: 1.4 }}>{e.text}</div> : null}
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", left: 0, right: u(16), top: 0, bottom: 0 }}>
      <div style={{ position: "absolute", bottom: "64%", left: 0, ...enterStyle(p, u(20)), fontFamily: fonts.mono, fontSize: u(34), color: c.accent, fontWeight: 700 }}>
        {e.date}
      </div>
      <div style={{ position: "absolute", top: `calc(38% - ${u(12)}px)`, left: 0 }}>{dot}</div>
      <div style={{ position: "absolute", top: `calc(38% + ${u(44)}px)`, left: 0, right: 0, ...enterStyle(p, u(24)) }}>
        <div style={{ fontFamily: fonts.heading, fontSize: u(36), fontWeight: 700, color: c.text, lineHeight: 1.15, marginBottom: u(10) }}>{e.title}</div>
        {e.text ? <div style={{ fontFamily: fonts.body, fontSize: u(26), color: c.muted, lineHeight: 1.4 }}>{e.text}</div> : null}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- comparison

const TONE_SYMBOL = { good: "✓", bad: "✕", neutral: "•" } as const;

export const ComparisonScene: React.FC = () => {
  const d = useSceneData<SceneOf<"comparison">>();
  const scene = useScene();
  const { theme, fonts } = useTheme();
  const { u, portrait } = useLayout();
  const vs = useEnter(4);
  const c = theme.colors;
  const toneColor = (t: "good" | "bad" | "neutral") => (t === "good" ? c.success : t === "bad" ? c.danger : c.primary);

  const column = (col: SceneOf<"comparison">["left"], side: "left" | "right", delay: number) => {
    const color = toneColor(col.tone);
    return (
      <ColumnCard key={side} delay={delay} color={color}>
        <div style={{ display: "flex", alignItems: "center", gap: u(16), marginBottom: u(30) }}>
          <Marker symbol={TONE_SYMBOL[col.tone]} color={color} size={52} />
          <div style={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: u(48), color: c.text }}>{col.title}</div>
        </div>
        {col.points.map((p, i) => (
          <CompPoint key={i} text={p.text} at={cueAt(scene.cues, p.cue, 16 + i * 20 + (side === "right" ? 10 : 0))} color={color} />
        ))}
      </ColumnCard>
    );
  };

  return (
    <SceneShell>
      {d.heading ? <Heading text={d.heading} size={64} /> : null}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: portrait ? "column" : "row", alignItems: portrait ? "stretch" : "center", gap: u(portrait ? 40 : 90), position: "relative" }}>
        {column(d.left, "left", 0)}
        {column(d.right, "right", 6)}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) scale(${vs})`,
            width: u(96),
            height: u(96),
            borderRadius: "50%",
            background: c.accent,
            color: c.background,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fonts.heading,
            fontWeight: 800,
            fontSize: u(36),
            boxShadow: `0 ${u(10)}px ${u(30)}px ${alpha("#000000", 0.3)}`,
          }}
        >
          VS
        </div>
      </div>
    </SceneShell>
  );
};

const ColumnCard: React.FC<{ delay: number; color: string; children: React.ReactNode }> = ({ delay, color, children }) => {
  const { u } = useLayout();
  const p = useEnter(delay, { slower: true });
  return (
    <Card tone={color} style={{ flex: 1, ...enterStyle(p, u(40), 0), borderTop: `${u(6)}px solid ${color}` }}>
      {children}
    </Card>
  );
};

const CompPoint: React.FC<{ text: string; at: number; color: string }> = ({ text, at, color }) => {
  const { theme, fonts } = useTheme();
  const { u } = useLayout();
  const p = useEnter(at);
  return (
    <div style={{ display: "flex", gap: u(18), alignItems: "flex-start", marginBottom: u(22), ...enterFromLeft(p, u(30)) }}>
      <div style={{ width: u(12), height: u(12), borderRadius: "50%", background: color, marginTop: u(16), flex: "none" }} />
      <div style={{ fontFamily: fonts.body, fontSize: u(40), lineHeight: 1.35, color: theme.colors.text }}>{text}</div>
    </div>
  );
};
