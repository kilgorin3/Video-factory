import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { PointSpec, SceneOf } from "../../spec/schema";
import { groupCaptionLines } from "../../text/captions";
import { Media } from "../components/Media";
import {
  Card,
  fitSize,
  Heading,
  ImageCard,
  Marker,
  Pill,
  SceneShell,
  StaggerWords,
  useScene,
  useSceneData,
} from "../components/kit";
import { cueAt, enterFromLeft, enterStyle, progress, useEnter } from "../lib/anim";
import { alpha, useLayout, useTheme } from "../theme";

// ---------------------------------------------------------------- title

export const TitleScene: React.FC = () => {
  const d = useSceneData<SceneOf<"title">>();
  const scene = useScene();
  const { theme, fonts } = useTheme();
  const { u, portrait } = useLayout();
  const kick = useEnter(2);
  const bar = useEnter(16);
  const sub = useEnter(20);
  const c = theme.colors;
  return (
    <AbsoluteFill>
      {scene.visual && scene.background !== "visual" ? (
        <>
          <Media visual={scene.visual} durationInFrames={scene.durationInFrames} seed={scene.index} />
          <AbsoluteFill
            style={{
              background: portrait
                ? `linear-gradient(0deg, ${alpha(c.background, 0.95)} 25%, ${alpha(c.background, 0.35)} 100%)`
                : `linear-gradient(90deg, ${alpha(c.background, 0.94)} 30%, ${alpha(c.background, 0.25)} 100%)`,
            }}
          />
        </>
      ) : null}
      <SceneShell style={{ justifyContent: "center" }}>
        <div style={{ maxWidth: portrait ? "100%" : "74%" }}>
          {d.kicker ? (
            <div style={{ ...enterStyle(kick, u(20)), marginBottom: u(34) }}>
              <Pill>{d.kicker}</Pill>
            </div>
          ) : null}
          <StaggerWords
            text={d.title}
            delay={6}
            stagger={3}
            style={{
              fontFamily: fonts.heading,
              fontWeight: 800,
              fontSize: u(fitSize(d.title, portrait ? 100 : 124)),
              lineHeight: 1.03,
              letterSpacing: "-0.03em",
              color: c.text,
            }}
          />
          <div
            style={{
              width: u(170) * bar,
              height: u(10),
              borderRadius: u(5),
              background: `linear-gradient(90deg, ${c.accent}, ${c.primary})`,
              margin: `${u(42)}px 0 ${u(34)}px`,
            }}
          />
          {d.subtitle ? (
            <div
              style={{
                ...enterStyle(sub, u(24)),
                fontFamily: fonts.body,
                fontSize: u(portrait ? 40 : 44),
                lineHeight: 1.35,
                color: c.muted,
                maxWidth: "92%",
              }}
            >
              {d.subtitle}
            </div>
          ) : null}
        </div>
      </SceneShell>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- chapter

export const ChapterScene: React.FC = () => {
  const d = useSceneData<SceneOf<"chapter">>();
  const scene = useScene();
  const { theme, fonts, timeline } = useTheme();
  const frame = useCurrentFrame();
  const { u, portrait } = useLayout();
  const c = theme.colors;
  const number =
    d.number ?? timeline.chapters.filter((ch) => ch.title !== "Intro" && ch.startFrame <= scene.startFrame).length;
  const label = useEnter(2);
  const line = progress(frame, 8, 30);
  const sub = useEnter(20);
  const drift = interpolate(frame, [0, scene.durationInFrames], [0, -u(40)]);
  return (
    <SceneShell style={{ justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          right: portrait ? -u(40) : u(60),
          top: portrait ? u(180) : "50%",
          transform: `translateY(${portrait ? 0 : "-55%"}) translateX(${drift}px)`,
          fontFamily: fonts.heading,
          fontWeight: 800,
          fontSize: u(portrait ? 420 : 560),
          lineHeight: 1,
          color: "transparent",
          WebkitTextStroke: `${u(3)}px ${alpha(c.primary, 0.32)}`,
          opacity: label,
        }}
      >
        {String(number).padStart(2, "0")}
      </div>
      <div style={{ position: "relative", maxWidth: portrait ? "100%" : "70%" }}>
        <div style={{ ...enterStyle(label, u(16)), marginBottom: u(30) }}>
          <Pill color={c.primary}>Chapter {String(number).padStart(2, "0")}</Pill>
        </div>
        <StaggerWords
          text={d.title}
          delay={6}
          style={{
            fontFamily: fonts.heading,
            fontWeight: 800,
            fontSize: u(fitSize(d.title, portrait ? 92 : 108)),
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            color: c.text,
          }}
        />
        <div style={{ height: u(4), width: `${line * 60}%`, background: alpha(c.text, 0.18), margin: `${u(40)}px 0 ${u(30)}px` }} />
        {d.subtitle ? (
          <div style={{ ...enterStyle(sub, u(20)), fontFamily: fonts.body, fontSize: u(40), color: c.muted, lineHeight: 1.35 }}>
            {d.subtitle}
          </div>
        ) : null}
      </div>
    </SceneShell>
  );
};

// ---------------------------------------------------------------- bullets / split

const PointRow: React.FC<{
  text: string;
  at: number;
  index: number;
  numbered: boolean;
  /** Frame when a later point appears and this one should step back. */
  dimAt: number | null;
  size: number;
}> = ({ text, at, index, numbered, dimAt, size }) => {
  const { theme, fonts } = useTheme();
  const { u } = useLayout();
  const p = useEnter(at);
  const frame = useCurrentFrame();
  const dim =
    dimAt === null ? 1 : interpolate(frame, [dimAt, dimAt + 10], [1, 0.42], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: u(28),
        marginBottom: u(30),
        ...enterFromLeft(p, u(50)),
        opacity: Math.min(1, p * 1.5) * dim,
      }}
    >
      <div style={{ paddingTop: u(size * 0.08) }}>
        {numbered ? <Marker n={index + 1} size={size * 1.1} /> : <Marker color={theme.colors.accent} size={size * 0.9} />}
      </div>
      <div
        style={{
          fontFamily: fonts.body,
          fontWeight: 500,
          fontSize: u(size),
          lineHeight: 1.3,
          color: theme.colors.text,
        }}
      >
        {text}
      </div>
    </div>
  );
};

function usePointTimes(points: PointSpec[], fallbackStart = 14, gap = 14) {
  const scene = useScene();
  return { times: points.map((p, i) => cueAt(scene.cues, p.cue, fallbackStart + i * gap)) };
}

const PointList: React.FC<{ points: PointSpec[]; numbered?: boolean; focus?: boolean; size?: number }> = ({
  points,
  numbered = false,
  focus = true,
  size,
}) => {
  const { portrait } = useLayout();
  const { times } = usePointTimes(points);
  const fontSize = size ?? (points.length > 5 ? 38 : portrait ? 44 : 46);
  return (
    <div>
      {points.map((p, i) => (
        <PointRow
          key={i}
          text={p.text}
          at={times[i]}
          index={i}
          numbered={numbered}
          dimAt={focus && i < points.length - 1 ? times[i + 1] : null}
          size={fontSize}
        />
      ))}
    </div>
  );
};

export const BulletsScene: React.FC = () => {
  const d = useSceneData<SceneOf<"bullets">>();
  const scene = useScene();
  const { u, portrait } = useLayout();
  const side = scene.visual && scene.background !== "visual";
  return (
    <SceneShell>
      <Heading text={d.heading} />
      <div style={{ display: "flex", flexDirection: portrait ? "column-reverse" : "row", gap: u(70), flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1.25 }}>
          <PointList points={d.points} numbered={d.numbered} focus={d.focus} />
        </div>
        {side ? <ImageCard style={{ flex: 1, minHeight: portrait ? u(520) : undefined, maxHeight: portrait ? u(620) : undefined }} /> : null}
      </div>
    </SceneShell>
  );
};

export const SplitScene: React.FC = () => {
  const d = useSceneData<SceneOf<"split">>();
  const { theme, fonts } = useTheme();
  const { u, portrait } = useLayout();
  const body = useEnter(10);
  const text = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <Heading text={d.heading} size={64} />
      {d.body ? (
        <div
          style={{
            ...enterStyle(body, u(20)),
            fontFamily: fonts.body,
            fontSize: u(40),
            lineHeight: 1.45,
            color: theme.colors.muted,
            marginBottom: u(36),
          }}
        >
          {d.body}
        </div>
      ) : null}
      {d.points.length ? <PointList points={d.points} size={40} /> : null}
    </div>
  );
  const image = <ImageCard style={{ flex: portrait ? undefined : 1, height: portrait ? u(640) : undefined }} />;
  return (
    <SceneShell>
      <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", gap: u(80), flex: 1, minHeight: 0 }}>
        {portrait || d.side === "left" ? image : null}
        {text}
        {!portrait && d.side === "right" ? image : null}
      </div>
    </SceneShell>
  );
};

// ---------------------------------------------------------------- quote

export const QuoteScene: React.FC = () => {
  const d = useSceneData<SceneOf<"quote">>();
  const { theme, fonts } = useTheme();
  const { u, portrait } = useLayout();
  const mark = useEnter(0, { slower: true });
  const by = useEnter(12 + d.quote.split(/\s+/).length * 2);
  const c = theme.colors;
  return (
    <SceneShell style={{ justifyContent: "center" }}>
      <div style={{ maxWidth: portrait ? "100%" : "82%", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: -u(30),
            top: -u(190),
            fontFamily: fonts.heading,
            fontSize: u(360),
            lineHeight: 1,
            color: alpha(c.accent, 0.3),
            opacity: mark,
            transform: `scale(${0.8 + 0.2 * mark})`,
          }}
        >
          “
        </div>
        <StaggerWords
          text={d.quote}
          delay={6}
          stagger={2}
          style={{
            position: "relative",
            fontFamily: fonts.heading,
            fontWeight: 600,
            fontSize: u((d.quote.length < 80 ? 80 : d.quote.length < 140 ? 66 : 54) * (portrait ? 0.85 : 1)),
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
            color: c.text,
          }}
        />
        {d.author ? (
          <div style={{ ...enterStyle(by, u(16)), display: "flex", alignItems: "center", gap: u(20), marginTop: u(50) }}>
            <div style={{ width: u(56), height: u(4), background: c.accent, borderRadius: u(2) }} />
            <div style={{ fontFamily: fonts.body, fontSize: u(36), color: c.text, fontWeight: 600 }}>
              {d.author}
              {d.role ? <span style={{ color: c.muted, fontWeight: 400 }}>{`, ${d.role}`}</span> : null}
            </div>
          </div>
        ) : null}
      </div>
    </SceneShell>
  );
};

// ---------------------------------------------------------------- definition

export const DefinitionScene: React.FC = () => {
  const d = useSceneData<SceneOf<"definition">>();
  const { theme, fonts } = useTheme();
  const { u, portrait } = useLayout();
  const card = useEnter(0, { slower: true });
  const term = useEnter(6);
  const meta = useEnter(12);
  const def = useEnter(18);
  const ex = useEnter(30);
  const c = theme.colors;
  return (
    <SceneShell center>
      <Card style={{ width: portrait ? "100%" : "78%", padding: u(70), ...enterStyle(card, u(40), 0) }}>
        <div style={{ ...enterStyle(term, u(20)), fontFamily: fonts.heading, fontWeight: 800, fontSize: u(fitSize(d.term, 110)), letterSpacing: "-0.03em", color: c.text, lineHeight: 1 }}>
          {d.term}
        </div>
        <div style={{ ...enterStyle(meta, u(14)), display: "flex", gap: u(24), alignItems: "center", margin: `${u(26)}px 0 ${u(36)}px` }}>
          {d.phonetic ? <span style={{ fontFamily: fonts.mono, fontSize: u(32), color: c.muted }}>{d.phonetic}</span> : null}
          {d.partOfSpeech ? <Pill color={c.primary}>{d.partOfSpeech}</Pill> : null}
        </div>
        <div style={{ height: 1, background: alpha(c.text, 0.12), marginBottom: u(36) }} />
        <div style={{ ...enterStyle(def, u(16)), fontFamily: fonts.body, fontSize: u(46), lineHeight: 1.4, color: c.text }}>
          {d.definition}
        </div>
        {d.example ? (
          <div
            style={{
              ...enterStyle(ex, u(14)),
              marginTop: u(36),
              paddingLeft: u(28),
              borderLeft: `${u(5)}px solid ${c.accent}`,
              fontFamily: fonts.body,
              fontStyle: "italic",
              fontSize: u(36),
              lineHeight: 1.45,
              color: c.muted,
            }}
          >
            {d.example}
          </div>
        ) : null}
      </Card>
    </SceneShell>
  );
};

// ---------------------------------------------------------------- kinetic

export const KineticScene: React.FC = () => {
  const d = useSceneData<SceneOf<"kinetic">>();
  const scene = useScene();
  const frame = useCurrentFrame();
  const { theme, fonts, timeline } = useTheme();
  const { u, portrait } = useLayout();
  const fps = timeline.meta.fps;
  const phrases = useMemo(
    () => groupCaptionLines(scene.words, { maxChars: portrait ? 18 : 26, maxDuration: fps * 2.4, maxGap: fps * 0.5 }),
    [scene.words, portrait, fps],
  );
  const emphasis = new Set(d.emphasis.map((e) => e.toLowerCase()));
  const clean = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const idx = phrases.findIndex((p, i) => frame >= p.start - 3 && frame < (phrases[i + 1]?.start ?? Infinity) - 3);
  const phrase = idx >= 0 ? phrases[idx] : null;

  return (
    <SceneShell center>
      {phrase ? (
        <div
          key={idx}
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            fontSize: u(portrait ? 96 : 124),
            columnGap: "0.28em",
            rowGap: u(8),
            maxWidth: portrait ? "100%" : "86%",
            textAlign: "center",
          }}
        >
          {phrase.words.map((w, i) => {
            // Ramp starts early so a new phrase never shows as an empty frame.
            const p = interpolate(frame, [w.start - 6, w.start + 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const hot = emphasis.has(clean(w.text));
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  fontFamily: fonts.heading,
                  fontWeight: 800,
                  fontSize: hot ? "1.12em" : "1em",
                  lineHeight: 1.08,
                  letterSpacing: "-0.03em",
                  color: hot ? theme.colors.accent : theme.colors.text,
                  opacity: p,
                  transform: `translateY(${(1 - p) * u(30)}px) scale(${0.92 + 0.08 * p})`,
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      ) : scene.words.length === 0 ? (
        <StaggerWords
          text={d.narration || " "}
          style={{ justifyContent: "center", fontFamily: fonts.heading, fontWeight: 800, fontSize: u(96), color: theme.colors.text }}
        />
      ) : null}
    </SceneShell>
  );
};

// ---------------------------------------------------------------- outro

export const OutroScene: React.FC = () => {
  const d = useSceneData<SceneOf<"outro">>();
  const frame = useCurrentFrame();
  const { theme, fonts } = useTheme();
  const { u, portrait } = useLayout();
  const c = theme.colors;
  const cta = useEnter(14);
  const btn = useEnter(22);
  const clickAt = 52;
  const clicked = frame >= clickAt;
  const press = interpolate(frame, [clickAt - 4, clickAt, clickAt + 6], [1, 0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bell = clicked ? Math.sin((frame - clickAt - 8) * 0.9) * Math.max(0, 1 - (frame - clickAt - 8) / 24) * 18 : 0;
  const slots = useEnter(10, { slower: true });
  const showSlots = d.endScreen && !portrait;

  return (
    <SceneShell style={{ justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", alignItems: "center", justifyContent: "center", gap: u(80), height: "100%" }}>
        <div style={{ flex: 1, textAlign: portrait ? "center" : "left" }}>
          <StaggerWords
            text={d.title}
            delay={2}
            style={{
              justifyContent: portrait ? "center" : "flex-start",
              fontFamily: fonts.heading,
              fontWeight: 800,
              fontSize: u(fitSize(d.title, portrait ? 88 : 96)),
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: c.text,
            }}
          />
          {d.cta ? (
            <div style={{ ...enterStyle(cta, u(18)), fontFamily: fonts.body, fontSize: u(40), lineHeight: 1.4, color: c.muted, margin: `${u(34)}px 0 ${u(50)}px` }}>
              {d.cta}
            </div>
          ) : (
            <div style={{ height: u(50) }} />
          )}
          {d.subscribe ? (
            <div
              style={{
                ...enterStyle(btn, u(24), 0),
                display: "inline-flex",
                alignItems: "center",
                gap: u(18),
                padding: `${u(22)}px ${u(40)}px`,
                borderRadius: 999,
                background: clicked ? alpha(c.text, 0.14) : "#FF0033",
                color: clicked ? c.text : "#FFFFFF",
                fontFamily: fonts.body,
                fontWeight: 700,
                fontSize: u(38),
                transform: `scale(${press})`,
                boxShadow: clicked ? "none" : `0 ${u(12)}px ${u(40)}px ${alpha("#FF0033", 0.35)}`,
              }}
            >
              {clicked ? "Subscribed" : "Subscribe"}
              {clicked ? (
                <svg width={u(36)} height={u(36)} viewBox="0 0 24 24" style={{ transform: `rotate(${bell}deg)`, transformOrigin: "50% 10%" }}>
                  <path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z" />
                </svg>
              ) : null}
            </div>
          ) : null}
        </div>
        {showSlots ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: u(36), opacity: slots, transform: `translateX(${(1 - slots) * u(60)}px)` }}>
            {["Watch next", "Recommended"].map((label) => (
              <div
                key={label}
                style={{
                  aspectRatio: "16 / 9",
                  width: "100%",
                  maxHeight: u(300),
                  borderRadius: u(theme.radius * 0.7),
                  border: `${u(3)}px dashed ${alpha(c.text, 0.25)}`,
                  background: alpha(c.surface, 0.4),
                  display: "flex",
                  alignItems: "flex-end",
                  padding: u(22),
                  fontFamily: fonts.body,
                  fontSize: u(26),
                  fontWeight: 600,
                  color: c.muted,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </SceneShell>
  );
};
