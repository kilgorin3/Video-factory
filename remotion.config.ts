// Settings used by `npx remotion studio` / `npx remotion render`.
// The factory's own renderer (src/pipeline/render.ts) passes equivalent options programmatically.
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setColorSpace("bt709");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(18);
