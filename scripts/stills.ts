/**
 * Render single frames of a built project as PNGs, for fast visual checks
 * without a full render:  npx tsx scripts/stills.ts projects/x 120 480 900
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { projectPaths } from "../src/pipeline/project";
import { bundleFor } from "../src/pipeline/render";
import type { Timeline } from "../src/timeline/types";
import { ensureDir } from "../src/util/fsx";

const [dir, ...frames] = process.argv.slice(2);
const paths = projectPaths(path.resolve(dir));
const timeline = JSON.parse(await readFile(paths.timeline, "utf8")) as Timeline;
const serveUrl = await bundleFor(paths.public);
const inputProps = { timeline };
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
const composition = await selectComposition({ serveUrl, id: "Video", inputProps, browserExecutable, logLevel: "error" });
const outDir = await ensureDir(path.join(paths.build, "stills"));
for (const f of frames.map(Number)) {
  const output = path.join(outDir, `frame-${f}.png`);
  await renderStill({ composition, serveUrl, output, inputProps, frame: f, scale: 0.5, browserExecutable, logLevel: "error" });
  console.log(output);
}
