import { describe, expect, it } from "vitest";
import { extractYAML } from "../src/planner/plan";
import { lintSpec } from "../src/pipeline/lint";
import { youtubeChapters } from "../src/pipeline/post";
import { buildTimeline } from "../src/pipeline/timeline";
import type { VoiceAsset } from "../src/pipeline/assets";
import { checkSpec, parseSpec } from "../src/spec/load";
import { contrastRatio, resolveTheme, THEMES } from "../src/spec/themes";
import { groupCaptionLines, toSRT, chapterStamp } from "../src/text/captions";
import { cueTimes, estimateAlignment, parseNarration, wordsFromAlignment } from "../src/text/narration";

describe("narration", () => {
  it("extracts cues and keeps display text clean", () => {
    const p = parseNarration("First [[a]]alpha, then[[b]] beta and [[c]] gamma.");
    expect(p.displayText).toBe("First alpha, then beta and gamma.");
    expect(p.cues).toEqual({ a: 1, b: 3, c: 5 });
    expect(p.ttsText).toBe(p.displayText);
  });

  it("applies pronunciations to TTS text only", () => {
    const p = parseNarration("We query SQL, then nginx.", { pronunciations: { SQL: "sequel", nginx: "engine x" } });
    expect(p.ttsText).toBe("We query sequel, then engine x.");
    expect(p.displayText).toBe("We query SQL, then nginx.");
    expect(p.ttsText.slice(p.words[2].ttsStart, p.words[2].ttsEnd)).toBe("sequel,");
  });

  it("drops audio tags unless the engine supports them", () => {
    expect(parseNarration("[whispers softly] hello there").ttsText).toBe("hello there");
    expect(parseNarration("[whispers softly] hello", { keepAudioTags: true }).ttsText).toBe("[whispers softly] hello");
    expect(parseNarration("[whispers] hello", { keepAudioTags: true }).displayText).toBe("hello");
  });

  it("maps character alignment to word timings and cue times", () => {
    const p = parseNarration("Hello [[x]]big world");
    const al = estimateAlignment(p.ttsText, 3);
    const words = wordsFromAlignment(p, al);
    expect(words.map((w) => w.text)).toEqual(["Hello", "big", "world"]);
    for (let i = 1; i < words.length; i++) expect(words[i].start).toBeGreaterThanOrEqual(words[i - 1].end - 1e-9);
    expect(cueTimes(p, words).x).toBeCloseTo(words[1].start);
  });

  it("tolerates alignment that differs in whitespace", () => {
    const p = parseNarration("one two");
    const chars = ["o", "n", "e", "t", "w", "o"];
    const words = wordsFromAlignment(p, { characters: chars, starts: chars.map((_, i) => i), ends: chars.map((_, i) => i + 1) });
    expect(words[1]).toMatchObject({ text: "two", start: 3, end: 6 });
  });
});

describe("captions", () => {
  const words = "The quick brown fox jumps over the lazy dog. It was fun.".split(" ").map((t, i) => ({ text: t, start: i * 300, end: i * 300 + 250 }));

  it("breaks lines at sentence ends and length", () => {
    const lines = groupCaptionLines(words, { maxChars: 20, maxDuration: 10000, maxGap: 1000 });
    expect(lines.every((l) => l.text.length <= 20 || l.words.length === 1)).toBe(true);
    expect(lines.some((l) => l.text.endsWith("dog."))).toBe(true);
  });

  it("writes valid SRT", () => {
    const srt = toSRT(words);
    expect(srt).toMatch(/^1\n00:00:00,000 --> 00:00:0\d,\d{3}\n/);
    expect(srt).toContain("lazy dog.");
  });

  it("formats chapter stamps", () => {
    expect(chapterStamp(0)).toBe("0:00");
    expect(chapterStamp(75.9)).toBe("1:15");
    expect(chapterStamp(3725)).toBe("1:02:05");
  });
});

const baseSpec = {
  title: "Test video",
  scenes: [
    { type: "title", title: "Hi", narration: "Welcome to the test.", chapter: "Intro" },
    {
      type: "bullets",
      heading: "Points",
      points: [{ text: "One", cue: "one" }, "Two"],
      narration: "Here is [[one]] the first point and then the second.",
      chapter: "Body",
    },
    { type: "outro", narration: "Bye now.", chapter: "End", endScreen: false },
  ],
};

describe("spec", () => {
  it("applies defaults", () => {
    const s = parseSpec(baseSpec);
    expect(s.slug).toBe("test-video");
    expect(s.format).toEqual({ aspect: "16:9", fps: 30 });
    expect(s.style.captions.enabled).toBe(true);
    expect(s.voice.provider).toBe("elevenlabs");
    expect(s.youtube.privacy).toBe("private");
  });

  it("flags cues missing from narration", () => {
    const bad = structuredClone(baseSpec);
    (bad.scenes[1] as { narration: string }).narration = "No markers here.";
    const issues = checkSpec(parseSpec(bad), "/tmp");
    expect(issues.some((i) => i.level === "error" && i.message.includes('"one"'))).toBe(true);
  });

  it("rejects unknown scene types with a readable error", () => {
    expect(() => parseSpec({ title: "x yz", scenes: [{ type: "hologram" }] })).toThrow(/invalid/i);
  });

  it("lints slow hooks and monotony", () => {
    const long = Array.from({ length: 80 }, () => "word").join(" ");
    const s = parseSpec({
      title: "Lint me",
      scenes: [
        { type: "title", title: "T", narration: long },
        { type: "quote", quote: "a", narration: "x" },
        { type: "quote", quote: "b", narration: "y" },
        { type: "quote", quote: "c", narration: "z" },
      ],
    });
    const msgs = lintSpec(s).issues.map((i) => i.message).join("\n");
    expect(msgs).toMatch(/payoff/);
    expect(msgs).toMatch(/Three quote scenes/);
  });
});

describe("themes", () => {
  it("presets meet text contrast", () => {
    for (const t of Object.values(THEMES)) expect(contrastRatio(t.colors.text, t.colors.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("merges overrides", () => {
    const t = resolveTheme(parseSpec({ ...baseSpec, style: { theme: "paper", colors: { accent: "#123456" } } }).style);
    expect(t.colors.accent).toBe("#123456");
    expect(t.fonts.heading).toBe("Fraunces");
  });
});

describe("timeline", () => {
  const spec = parseSpec(baseSpec);
  const voice = (scene: number, durationSec: number, cueSec?: number): VoiceAsset => ({
    scene,
    src: `audio/${scene}.mp3`,
    durationSec,
    words: [{ text: "w", start: 0, end: durationSec }],
    cues: cueSec === undefined ? {} : { one: cueSec },
  });
  const t = buildTimeline({
    spec,
    theme: resolveTheme(spec.style),
    slug: "t",
    voices: [voice(0, 2), voice(1, 6, 1.5), voice(2, 1)],
    visuals: [null, null, null],
    music: null,
    logo: null,
    sfxFiles: [[], [], []],
  });

  it("overlaps scenes by the transition length", () => {
    const [a, b] = t.scenes;
    expect(b.transition?.durationInFrames).toBe(15);
    expect(b.startFrame).toBe(a.startFrame + a.durationInFrames - 15);
    const last = t.scenes[t.scenes.length - 1];
    expect(t.meta.durationInFrames).toBe(last.startFrame + last.durationInFrames);
  });

  it("never lets narration overlap", () => {
    const n = t.audio.narration;
    for (let i = 1; i < n.length; i++) expect(n[i].startFrame).toBeGreaterThan(n[i - 1].startFrame + n[i - 1].durationInFrames);
  });

  it("places cues relative to scene start, and auto-cues the rest", () => {
    const b = t.scenes[1];
    expect(b.cues.one).toBe(Math.round(0.35 * 30) + Math.round(1.5 * 30));
    const data = b.data as { points: { cue?: string }[] };
    expect(data.points[1].cue).toMatch(/^__auto/);
    expect(b.cues[data.points[1].cue!]).toBeGreaterThan(0);
    expect((spec.scenes[1] as { points: { cue?: string }[] }).points[1].cue).toBeUndefined();
  });

  it("produces YouTube-valid chapters only when long enough", () => {
    const check = youtubeChapters(t);
    expect(check.lines[0]).toBe("0:00 Intro");
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/10s/);
  });
});

describe("planner", () => {
  it("extracts the yaml block", () => {
    expect(extractYAML("Sure!\n```yaml\ntitle: x\n```\nDone")).toBe("title: x\n");
    expect(extractYAML("title: y")).toBe("title: y");
  });
});
