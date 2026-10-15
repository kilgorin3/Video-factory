import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { chmod, readFile, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { loadProject } from "../pipeline/project";
import type { YouTubeMetadata } from "../pipeline/post";
import { ProviderError, requireEnv } from "../providers/http";
import { ensureDir, exists, readJSON, writeJSON } from "../util/fsx";
import { log } from "../util/log";

/**
 * Upload with the YouTube Data API v3 using plain HTTPS (no googleapis SDK).
 * Quota: an upload costs ~1,600 of the default 10,000 daily units (~6 uploads/day).
 * Projects that haven't passed Google's API audit can only upload as private.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TOKEN_FILE = () => process.env.YOUTUBE_TOKEN_FILE || path.join(repoRoot, ".secrets", "youtube.json");
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.force-ssl"];

type Stored = { refresh_token: string };

export async function authorize() {
  const clientId = requireEnv("YOUTUBE_CLIENT_ID", "youtube");
  const clientSecret = requireEnv("YOUTUBE_CLIENT_SECRET", "youtube");
  const server = http.createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const redirect = `http://127.0.0.1:${port}`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  })}`;
  log.step("Open this URL, pick your channel, and approve:");
  log.info(url);

  const code = await new Promise<string>((resolve, reject) => {
    server.on("request", (req, res) => {
      const q = new URL(req.url ?? "/", redirect).searchParams;
      const c = q.get("code");
      res.end(c ? "Authorized. You can close this tab." : `Authorization failed: ${q.get("error")}`);
      server.close();
      c ? resolve(c) : reject(new Error(q.get("error") ?? "no code"));
    });
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const json = (await res.json()) as { refresh_token?: string; error_description?: string };
  if (!json.refresh_token) throw new ProviderError("youtube", json.error_description ?? "No refresh token returned");
  await ensureDir(path.dirname(TOKEN_FILE()));
  await writeFile(TOKEN_FILE(), JSON.stringify({ refresh_token: json.refresh_token }));
  await chmod(TOKEN_FILE(), 0o600);
  log.ok(`Saved credentials to ${TOKEN_FILE()} (keep it out of git)`);
}

async function accessToken(): Promise<string> {
  if (!exists(TOKEN_FILE())) throw new ProviderError("youtube", "Not authorized yet. Run: vf youtube-auth");
  const { refresh_token } = await readJSON<Stored>(TOKEN_FILE());
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token,
      client_id: requireEnv("YOUTUBE_CLIENT_ID", "youtube"),
      client_secret: requireEnv("YOUTUBE_CLIENT_SECRET", "youtube"),
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!json.access_token) throw new ProviderError("youtube", `Token refresh failed: ${json.error_description ?? res.status}. Run vf youtube-auth again.`);
  return json.access_token;
}

async function ok(res: Response, what: string) {
  if (!res.ok) throw new ProviderError("youtube", `${what} failed: HTTP ${res.status} ${await res.text()}`);
  return res;
}

export async function publishProject(dir: string, o: { privacy?: YouTubeMetadata["privacyStatus"]; force?: boolean } = {}) {
  const p = await loadProject(dir, { strict: false });
  const out = p.paths.out;
  const metaFile = path.join(out, "youtube.json");
  const video = path.join(out, `${p.slug}.mp4`);
  if (!exists(metaFile) || !exists(video)) throw new Error(`Build first: vf build ${dir}`);
  const published = path.join(out, "published.json");
  if (exists(published) && !o.force) {
    const prev = await readJSON<{ url: string }>(published);
    throw new Error(`Already uploaded: ${prev.url}. Delete ${published} to upload again.`);
  }

  const meta = await readJSON<YouTubeMetadata>(metaFile);
  const privacy = o.privacy ?? meta.privacyStatus;
  const token = await accessToken();
  const auth = { Authorization: `Bearer ${token}` };
  const size = (await stat(video)).size;

  log.step(`Uploading ${(size / 1e6).toFixed(1)} MB as ${privacy}`);
  const init = await ok(
    await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        ...auth,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(size),
      },
      body: JSON.stringify({
        snippet: {
          title: meta.title,
          description: meta.description,
          tags: meta.tags,
          categoryId: meta.categoryId,
          defaultLanguage: meta.defaultLanguage,
          defaultAudioLanguage: meta.defaultLanguage,
        },
        status: {
          privacyStatus: privacy,
          selfDeclaredMadeForKids: meta.madeForKids,
          containsSyntheticMedia: meta.containsSyntheticMedia,
        },
      }),
    }),
    "Upload session",
  );
  const location = init.headers.get("location");
  if (!location) throw new ProviderError("youtube", "No upload URL returned");

  const put = await ok(
    await fetch(location, {
      method: "PUT",
      headers: { ...auth, "Content-Type": "video/mp4", "Content-Length": String(size) },
      body: Readable.toWeb(createReadStream(video)) as ReadableStream,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
    "Video upload",
  );
  const { id } = (await put.json()) as { id: string };
  const url = `https://youtu.be/${id}`;
  log.ok(`Uploaded: ${url}`);

  const thumb = path.join(out, "thumbnail.png");
  if (exists(thumb)) {
    try {
      const file = await under2MB(thumb);
      await ok(
        await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${id}&uploadType=media`, {
          method: "POST",
          headers: { ...auth, "Content-Type": file.endsWith(".png") ? "image/png" : "image/jpeg" },
          body: await readFile(file),
        }),
        "Thumbnail",
      );
      log.ok("Thumbnail set");
    } catch (e) {
      log.warn(`${(e as Error).message} (custom thumbnails need a phone-verified channel)`);
    }
  }

  const srt = path.join(out, "captions.srt");
  if (p.spec.youtube.uploadCaptions && exists(srt)) {
    try {
      const boundary = `vf${Date.now()}`;
      const body = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({
            snippet: { videoId: id, language: meta.defaultLanguage, name: "", isDraft: false },
          })}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
        ),
        await readFile(srt),
        Buffer.from(`\r\n--${boundary}--`),
      ]);
      await ok(
        await fetch("https://www.googleapis.com/upload/youtube/v3/captions?part=snippet&uploadType=multipart", {
          method: "POST",
          headers: { ...auth, "Content-Type": `multipart/related; boundary=${boundary}` },
          body,
        }),
        "Captions",
      );
      log.ok("Captions uploaded");
    } catch (e) {
      log.warn((e as Error).message);
    }
  }

  if (meta.playlistId) {
    try {
      await ok(
        await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=snippet", {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ snippet: { playlistId: meta.playlistId, resourceId: { kind: "youtube#video", videoId: id } } }),
        }),
        "Playlist",
      );
      log.ok("Added to playlist");
    } catch (e) {
      log.warn((e as Error).message);
    }
  }

  await writeJSON(published, { id, url, privacy, uploadedAt: new Date().toISOString() });
  log.info(`Review it in YouTube Studio, then add end-screen elements over the outro and publish.`);
  return { id, url };
}

/** YouTube rejects thumbnails over 2 MB; re-encode as JPEG if needed. */
async function under2MB(file: string): Promise<string> {
  if ((await stat(file)).size < 2 * 1024 * 1024) return file;
  const jpg = file.replace(/\.png$/, ".jpg");
  await promisify(execFile)(process.env.FFMPEG_PATH || "ffmpeg", ["-y", "-i", file, "-q:v", "3", jpg]);
  return jpg;
}
