import { download, fetchRetry, ProviderError, requireEnv } from "../http";
import type { Aspect, ImageProvider, MediaResult, VideoProvider } from "../types";

/** Pexels: free stock photos and video, commercial use allowed, attribution appreciated. */

const orientation = (a: Aspect) => (a === "16:9" ? "landscape" : a === "9:16" ? "portrait" : "square");

export const pexelsImage: ImageProvider = {
  name: "pexels",
  defaultModel: "pexels-photos",
  async generate(req): Promise<MediaResult> {
    const key = requireEnv("PEXELS_API_KEY", "pexels");
    const q = new URLSearchParams({ query: req.prompt, orientation: orientation(req.aspect), per_page: "10", size: "large" });
    const res = await fetchRetry("pexels", `https://api.pexels.com/v1/search?${q}`, { headers: { Authorization: key } });
    const json = (await res.json()) as {
      photos: { src: { original: string; large2x: string }; photographer: string }[];
    };
    if (!json.photos?.length) throw new ProviderError("pexels", `No photos for "${req.prompt}"`);
    const pick = json.photos[(req.seed ?? 0) % json.photos.length];
    return {
      data: await download("pexels", pick.src.large2x ?? pick.src.original),
      ext: "jpg",
      model: "pexels-photos",
      costUsd: 0,
      credit: `Photo: ${pick.photographer} / Pexels`,
    };
  },
};

export const pexelsVideo: VideoProvider = {
  name: "pexels",
  defaultModel: "pexels-videos",
  needsStartImage: () => false,
  async generate(req): Promise<MediaResult> {
    const key = requireEnv("PEXELS_API_KEY", "pexels");
    const q = new URLSearchParams({ query: req.prompt, orientation: orientation(req.aspect), per_page: "10", size: "medium" });
    const res = await fetchRetry("pexels", `https://api.pexels.com/videos/search?${q}`, { headers: { Authorization: key } });
    const json = (await res.json()) as {
      videos: {
        duration: number;
        user: { name: string };
        video_files: { link: string; width: number; height: number; file_type: string }[];
      }[];
    };
    const target = req.aspect === "9:16" ? 1080 : 1920;
    const candidates = (json.videos ?? []).filter((v) => v.duration >= Math.min(req.durationSec, 8));
    const pool = candidates.length ? candidates : json.videos ?? [];
    if (!pool.length) throw new ProviderError("pexels", `No videos for "${req.prompt}"`);
    const vid = pool[(req.seed ?? 0) % pool.length];
    const file = vid.video_files
      .filter((f) => f.file_type === "video/mp4")
      .sort((a, b) => Math.abs(a.width - target) - Math.abs(b.width - target))[0];
    if (!file) throw new ProviderError("pexels", "No mp4 rendition found");
    return {
      data: await download("pexels", file.link),
      ext: "mp4",
      model: "pexels-videos",
      costUsd: 0,
      credit: `Video: ${vid.user.name} / Pexels`,
    };
  },
};
