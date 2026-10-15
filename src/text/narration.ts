/**
 * Narration text handling.
 *
 * Authors write narration with optional markers:
 *   [[name]]      a cue: "the moment the narrator reaches this word". Scenes use cues
 *                 to reveal bullet points, chart bars, steps, code highlights...
 *   [whispers]    an ElevenLabs v3 audio tag. Sent to TTS, never shown in captions.
 *
 * Pronunciations ({"SQL": "sequel"}) change only what the TTS engine reads.
 * Captions always show the original spelling, so we keep a char-range mapping
 * from each display word to its span in the TTS text.
 */

export type NarrationWord = {
  /** Text as written (shown in captions). */
  text: string;
  /** [start, end) char range inside ttsText. */
  ttsStart: number;
  ttsEnd: number;
};

export type ParsedNarration = {
  ttsText: string;
  displayText: string;
  words: NarrationWord[];
  /** Cue name -> index of the word it precedes (words.length = after the last word). */
  cues: Record<string, number>;
};

export type Alignment = {
  characters: string[];
  starts: number[];
  ends: number[];
};

export type TimedWord = { text: string; start: number; end: number };

const TOKEN = /\[\[([\w.-]+)\]\]|\[[^[\]]+\]|(?:(?!\[\[)\S)+/g;
const EDGE_PUNCT = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u;

export function parseNarration(
  raw: string,
  opts: { pronunciations?: Record<string, string>; keepAudioTags?: boolean } = {},
): ParsedNarration {
  const pron = opts.pronunciations ?? {};
  const lowerPron = new Map(Object.entries(pron).map(([k, v]) => [k.toLowerCase(), v]));
  const words: NarrationWord[] = [];
  const cues: Record<string, number> = {};
  const ttsParts: string[] = [];
  let ttsLen = 0;

  const push = (part: string) => {
    if (ttsParts.length > 0) ttsLen += 1; // joining space
    const start = ttsLen;
    ttsParts.push(part);
    ttsLen += part.length;
    return start;
  };

  for (const m of raw.matchAll(TOKEN)) {
    const token = m[0];
    if (m[1]) {
      cues[m[1]] = words.length;
      continue;
    }
    if (token.startsWith("[") && token.endsWith("]")) {
      if (opts.keepAudioTags) push(token);
      continue;
    }
    const [, lead, core, trail] = token.match(EDGE_PUNCT) ?? ["", "", token, ""];
    const say = pron[core] ?? lowerPron.get(core.toLowerCase());
    const ttsWord = say ? `${lead}${say}${trail}` : token;
    const start = push(ttsWord);
    words.push({ text: token, ttsStart: start, ttsEnd: start + ttsWord.length });
  }

  return {
    ttsText: ttsParts.join(" "),
    displayText: words.map((w) => w.text).join(" "),
    words,
    cues,
  };
}

/**
 * Convert character-level alignment (ElevenLabs) into per-word timings for the
 * display words. Tolerates the provider normalizing whitespace or dropping chars.
 */
export function wordsFromAlignment(parsed: ParsedNarration, alignment: Alignment): TimedWord[] {
  const charTimes = mapCharsToAlignment(parsed.ttsText, alignment);
  return parsed.words.map((w) => {
    let start = Number.POSITIVE_INFINITY;
    let end = 0;
    for (let i = w.ttsStart; i < w.ttsEnd; i++) {
      const t = charTimes[i];
      if (!t) continue;
      start = Math.min(start, t.start);
      end = Math.max(end, t.end);
    }
    if (!Number.isFinite(start)) start = end;
    return { text: w.text, start, end: Math.max(end, start) };
  }).map(fillGaps);
}

function fillGaps(w: TimedWord, i: number, all: TimedWord[]): TimedWord {
  if (w.end > 0 || i === 0) return w;
  const prev = all[i - 1];
  return { ...w, start: prev.end, end: prev.end };
}

function mapCharsToAlignment(
  text: string,
  al: Alignment,
): ({ start: number; end: number } | undefined)[] {
  const out: ({ start: number; end: number } | undefined)[] = new Array(text.length);
  if (al.characters.join("") === text) {
    for (let i = 0; i < text.length; i++) out[i] = { start: al.starts[i], end: al.ends[i] };
    return out;
  }
  // Greedy two-pointer match, skipping whitespace on both sides.
  let j = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) continue;
    let k = j;
    while (k < al.characters.length && al.characters[k] !== c && k - j < 8) k++;
    if (k < al.characters.length && al.characters[k] === c) {
      out[i] = { start: al.starts[k], end: al.ends[k] };
      j = k + 1;
    } else if (j < al.characters.length) {
      out[i] = { start: al.starts[j], end: al.ends[j] };
    }
  }
  return out;
}

/**
 * Estimate a character alignment when the TTS provider returns none.
 * Weights pauses after punctuation so cues land close to where they are spoken.
 */
export function estimateAlignment(text: string, durationSec: number, leadSec = 0.05): Alignment {
  const weights = [...text].map((c) => {
    if (/[.!?]/.test(c)) return 7;
    if (/[,;:]/.test(c)) return 4;
    if (/[\u2014\u2013-]/.test(c)) return 2;
    return 1;
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const usable = Math.max(0.1, durationSec - leadSec - 0.1);
  const characters: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let t = leadSec;
  [...text].forEach((c, i) => {
    const d = (weights[i] / total) * usable;
    characters.push(c);
    starts.push(t);
    ends.push(t + d);
    t += d;
  });
  return { characters, starts, ends };
}

export function cueTimes(parsed: ParsedNarration, words: TimedWord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, idx] of Object.entries(parsed.cues)) {
    if (words.length === 0) out[name] = 0;
    else if (idx >= words.length) out[name] = words[words.length - 1].end;
    else out[name] = words[idx].start;
  }
  return out;
}

export function countWords(raw: string): number {
  return parseNarration(raw).words.length;
}

/** Cue names referenced by [[markers]] in a narration string. */
export function cueNames(raw: string): string[] {
  return Object.keys(parseNarration(raw).cues);
}
