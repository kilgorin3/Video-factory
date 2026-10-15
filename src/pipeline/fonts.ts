import path from "node:path";
import { download } from "../providers/http";
import { FONT_LIBRARY } from "../remotion/fonts";
import type { FontFile, Theme } from "../timeline/types";
import { copyInto } from "../util/fsx";
import { log } from "../util/log";
import { withCache } from "./cache";

const WEIGHTS = ["400", "500", "600", "700", "800"];
const SUBSETS = ["latin", "latin-ext"];

/**
 * Download the theme's Google Fonts into the build so renders never depend on
 * the network (render workers fetching fonts is the #1 cause of flaky renders).
 */
export async function vendorFonts(theme: Theme, publicDir: string): Promise<FontFile[]> {
  const families = [...new Set([theme.fonts.heading, theme.fonts.body, theme.fonts.mono])];
  const out: FontFile[] = [];
  for (const family of families) {
    const mod = FONT_LIBRARY[family];
    if (!mod) {
      log.warn(`Font "${family}" isn't in the built-in library (src/remotion/fonts.ts); falling back to a system font`);
      continue;
    }
    const info = mod.getInfo() as unknown as {
      fonts: { normal?: Record<string, Record<string, string>> };
      unicodeRanges: Record<string, string>;
    };
    const normal = info.fonts.normal ?? {};
    try {
      for (const weight of WEIGHTS.filter((w) => normal[w])) {
        for (const subset of SUBSETS) {
          const url = normal[weight][subset];
          if (!url) continue;
          const cached = await withCache("font", { url }, async () => ({ data: await download("fonts", url), ext: "woff2", meta: {} }));
          const src = `fonts/${cached.key}.woff2`;
          await copyInto(cached.file, path.join(publicDir, src));
          out.push({ family, weight, src, unicodeRange: info.unicodeRanges[subset] });
        }
      }
    } catch (e) {
      log.warn(`Couldn't download ${family} (${(e as Error).message}); falling back to a system font`);
    }
  }
  return out;
}
