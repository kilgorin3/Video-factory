import * as Archivo from "@remotion/google-fonts/Archivo";
import * as DMSans from "@remotion/google-fonts/DMSans";
import * as Figtree from "@remotion/google-fonts/Figtree";
import * as FiraCode from "@remotion/google-fonts/FiraCode";
import * as Fraunces from "@remotion/google-fonts/Fraunces";
import * as IBMPlexMono from "@remotion/google-fonts/IBMPlexMono";
import * as IBMPlexSans from "@remotion/google-fonts/IBMPlexSans";
import * as Inter from "@remotion/google-fonts/Inter";
import * as JetBrainsMono from "@remotion/google-fonts/JetBrainsMono";
import * as Lexend from "@remotion/google-fonts/Lexend";
import * as Lora from "@remotion/google-fonts/Lora";
import * as Manrope from "@remotion/google-fonts/Manrope";
import * as Merriweather from "@remotion/google-fonts/Merriweather";
import * as Montserrat from "@remotion/google-fonts/Montserrat";
import * as Nunito from "@remotion/google-fonts/Nunito";
import * as Outfit from "@remotion/google-fonts/Outfit";
import * as PlayfairDisplay from "@remotion/google-fonts/PlayfairDisplay";
import * as PlusJakartaSans from "@remotion/google-fonts/PlusJakartaSans";
import * as Poppins from "@remotion/google-fonts/Poppins";
import * as Sora from "@remotion/google-fonts/Sora";
import * as SpaceGrotesk from "@remotion/google-fonts/SpaceGrotesk";
import * as SpaceMono from "@remotion/google-fonts/SpaceMono";
import * as Urbanist from "@remotion/google-fonts/Urbanist";

type FontModule = {
  loadFont: (style?: "normal", options?: { weights?: string[]; subsets?: string[] }) => { fontFamily: string };
  getInfo: () => { fonts: Record<string, Record<string, Record<string, string>>> };
};

/**
 * Curated Google Fonts that read well on video. Use any of these names in
 * style.fonts. (Importing the full catalog would make every bundle huge.)
 */
export const FONT_LIBRARY: Record<string, FontModule> = {
  Archivo,
  "DM Sans": DMSans,
  Figtree,
  "Fira Code": FiraCode,
  Fraunces,
  "IBM Plex Mono": IBMPlexMono,
  "IBM Plex Sans": IBMPlexSans,
  Inter,
  "JetBrains Mono": JetBrainsMono,
  Lexend,
  Lora,
  Manrope,
  Merriweather,
  Montserrat,
  Nunito,
  Outfit,
  "Playfair Display": PlayfairDisplay,
  "Plus Jakarta Sans": PlusJakartaSans,
  Poppins,
  Sora,
  "Space Grotesk": SpaceGrotesk,
  "Space Mono": SpaceMono,
  Urbanist,
} as unknown as Record<string, FontModule>;

const WANTED = ["400", "500", "600", "700", "800"];
const loaded = new Map<string, string>();

/** Load a font family once and return the CSS font-family stack to use. */
export function ensureFont(family: string, fallback: string): string {
  const cached = loaded.get(family);
  if (cached) return cached;
  const mod = FONT_LIBRARY[family];
  let css = `${JSON.stringify(family)}, ${fallback}`;
  if (mod) {
    const available = Object.keys(mod.getInfo().fonts.normal ?? {});
    const weights = WANTED.filter((w) => available.includes(w));
    const { fontFamily } = mod.loadFont("normal", {
      weights: weights.length ? weights : available.slice(0, 3),
      subsets: ["latin"],
    });
    css = `${fontFamily}, ${fallback}`;
  }
  loaded.set(family, css);
  return css;
}
