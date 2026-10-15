import type { ImageProvider, MediaResult } from "../types";
import { hashOf } from "../../util/fsx";

/**
 * On-brand abstract artwork generated locally as SVG. Used by --mock builds and
 * as a stand-in while you iterate on the script before paying for images.
 */
export const placeholderImage: ImageProvider = {
  name: "placeholder",
  defaultModel: "svg",
  async generate(req): Promise<MediaResult> {
    const [w, h] = req.aspect === "16:9" ? [1920, 1080] : req.aspect === "9:16" ? [1080, 1920] : [1080, 1080];
    const p = req.palette ?? { background: "#0B1020", primary: "#7C9CFF", accent: "#FFB86B", text: "#F4F6FF" };
    const seed = parseInt(hashOf(req.prompt).slice(0, 8), 16);
    const rnd = mulberry32(seed);
    const blobs = Array.from({ length: 5 }, (_, i) => {
      const cx = Math.round(rnd() * w);
      const cy = Math.round(rnd() * h);
      const r = Math.round((0.18 + rnd() * 0.3) * Math.max(w, h));
      const fill = i % 2 === 0 ? p.primary : p.accent;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${(0.18 + rnd() * 0.25).toFixed(2)}"/>`;
    }).join("");
    const rings = Array.from({ length: 4 }, (_, i) => {
      const r = 120 + i * 90;
      return `<circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="none" stroke="${p.text}" stroke-opacity="${0.06 + i * 0.02}" stroke-width="2"/>`;
    }).join("");
    const label = escapeXml((req.label ?? req.prompt).slice(0, 90));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.round(w / 14)}"/></filter>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.background}"/><stop offset="1" stop-color="${p.primary}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="${p.background}"/>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <g filter="url(#b)">${blobs}</g>
  <g>${rings}</g>
  <text x="${w / 2}" y="${h - 70}" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(w / 64)}" fill="${p.text}" fill-opacity="0.45">placeholder · ${label}</text>
</svg>`;
    return { data: Buffer.from(svg), ext: "svg", model: "placeholder", costUsd: 0 };
  },
};

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}
