import type { Word } from "../timeline/types";

export type CaptionLine = { start: number; end: number; words: Word[]; text: string };

/**
 * Group timed words into caption lines. Units are whatever the words use
 * (frames for burned-in captions, ms for SRT/VTT).
 */
export function groupCaptionLines(
  words: Word[],
  opts: { maxChars: number; maxDuration: number; maxGap: number },
): CaptionLine[] {
  const lines: CaptionLine[] = [];
  let current: Word[] = [];
  let chars = 0;

  const flush = () => {
    if (current.length === 0) return;
    lines.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current,
      text: current.map((w) => w.text).join(" "),
    });
    current = [];
    chars = 0;
  };

  for (const w of words) {
    const prev = current[current.length - 1];
    const wouldBe = chars + (current.length ? 1 : 0) + w.text.length;
    const tooLong = current.length > 0 && wouldBe > opts.maxChars;
    const tooSlow = current.length > 0 && w.end - current[0].start > opts.maxDuration;
    const gap = prev ? w.start - prev.end > opts.maxGap : false;
    if (tooLong || tooSlow || gap) flush();
    current.push(w);
    chars += (current.length > 1 ? 1 : 0) + w.text.length;
    if (/[.!?]["')\]]?$/.test(w.text)) flush();
  }
  flush();
  return lines;
}

function stamp(ms: number, sep: "," | "."): string {
  const t = Math.max(0, Math.round(ms));
  const h = Math.floor(t / 3_600_000);
  const m = Math.floor((t % 3_600_000) / 60_000);
  const s = Math.floor((t % 60_000) / 1000);
  const r = t % 1000;
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(r, 3)}`;
}

/** Split a cue into two balanced lines at the space nearest the middle. */
function balance(text: string, maxLine: number): string {
  if (text.length <= maxLine) return text;
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return best < 0 ? text : `${text.slice(0, best)}\n${text.slice(best + 1)}`;
}

/** Words in milliseconds -> standard two-line subtitle cues. */
export function subtitleCues(wordsMs: Word[]): CaptionLine[] {
  const lines = groupCaptionLines(wordsMs, { maxChars: 84, maxDuration: 6000, maxGap: 900 });
  // Hold each cue until the next one starts (max +600ms) so text doesn't flash.
  return lines.map((l, i) => {
    const next = lines[i + 1];
    const end = next ? Math.min(next.start, l.end + 600) : l.end + 600;
    return { ...l, end: Math.max(end, l.start + 700) };
  });
}

export function toSRT(wordsMs: Word[]): string {
  return subtitleCues(wordsMs)
    .map((l, i) => `${i + 1}\n${stamp(l.start, ",")} --> ${stamp(l.end, ",")}\n${balance(l.text, 42)}\n`)
    .join("\n");
}

export function toVTT(wordsMs: Word[]): string {
  const body = subtitleCues(wordsMs)
    .map((l) => `${stamp(l.start, ".")} --> ${stamp(l.end, ".")}\n${balance(l.text, 42)}\n`)
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

/** YouTube chapter timestamp (m:ss or h:mm:ss). */
export function chapterStamp(seconds: number): string {
  const t = Math.floor(seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}
