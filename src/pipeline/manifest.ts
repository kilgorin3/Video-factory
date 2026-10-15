export type ManifestEntry = {
  scene: number | null;
  kind: "voice" | "image" | "video" | "music" | "file";
  provider: string;
  model: string;
  prompt?: string;
  file: string;
  costUsd: number;
  cached: boolean;
  credit?: string;
};

/**
 * Provenance for every generated asset: what made it, from what prompt, at what cost.
 * Useful for YouTube's synthetic-media disclosure, licensing questions, and budgets.
 */
export class Manifest {
  entries: ManifestEntry[] = [];

  add(e: ManifestEntry) {
    this.entries.push(e);
  }

  get spentUsd() {
    return this.entries.filter((e) => !e.cached).reduce((a, e) => a + e.costUsd, 0);
  }

  get savedByCacheUsd() {
    return this.entries.filter((e) => e.cached).reduce((a, e) => a + e.costUsd, 0);
  }

  get usesAIVideo() {
    return this.entries.some((e) => e.kind === "video" && e.provider === "fal");
  }

  toJSON() {
    return {
      generatedAt: new Date().toISOString(),
      spentThisRunUsd: round(this.spentUsd),
      savedByCacheUsd: round(this.savedByCacheUsd),
      entries: this.entries,
    };
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
