/**
 * Sourcing media with yt-dlp.
 *
 * Two distinct jobs, which is why this exists rather than a single download
 * helper:
 *
 *   footage — pull a clip to use as b-roll inside a scene
 *   audio   — pull the soundtrack of a video so Whisper can time a script to
 *             it, which is how you remake or localise an existing video
 *
 * Downloads are untrusted input. Each goes into its own directory under the
 * project, is probed before use, and is never passed to a shell.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export const ytDlpPath = (projectRoot: string): string =>
  join(projectRoot, ".venv-media", "bin", "yt-dlp");

export const ytDlpAvailable = (projectRoot: string): boolean =>
  existsSync(ytDlpPath(projectRoot));

const requireYtDlp = (projectRoot: string): string => {
  const bin = ytDlpPath(projectRoot);
  if (!existsSync(bin)) {
    throw new Error(
      "yt-dlp is not installed. Run:\n" +
        "  uv venv .venv-media --python 3.12\n" +
        "  uv pip install --python .venv-media faster-whisper yt-dlp",
    );
  }
  return bin;
};

/** Stable per-URL directory name, so a repeated fetch is a cache hit. */
const keyFor = (url: string): string =>
  createHash("sha256").update(url).digest("hex").slice(0, 16);

export type FetchOptions = {
  readonly url: string;
  readonly destDir: string;
  readonly projectRoot: string;
  /** "video" keeps the picture; "audio" extracts the soundtrack only. */
  readonly kind?: "video" | "audio";
  /** Cap the vertical resolution, to avoid pulling a 4K file for b-roll. */
  readonly maxHeight?: number;
  /** Trim to a section, e.g. "*00:01:10-00:01:25". */
  readonly section?: string;
};

export type FetchResult = {
  readonly path: string;
  readonly cached: boolean;
  readonly title: string;
  readonly durationSec: number;
};

export type MediaInfo = {
  readonly title: string;
  readonly durationSec: number;
  readonly width?: number;
  readonly height?: number;
  readonly uploader?: string;
};

/** Read metadata without downloading — useful for checking before committing. */
export const probeUrl = async (url: string, projectRoot: string): Promise<MediaInfo> => {
  const bin = requireYtDlp(projectRoot);
  const { stdout } = await run(bin, ["--dump-single-json", "--no-warnings", "--", url], {
    maxBuffer: 64 * 1024 * 1024,
  });
  const info = JSON.parse(stdout) as Record<string, unknown>;
  return {
    title: String(info["title"] ?? "untitled"),
    durationSec: Number(info["duration"] ?? 0),
    width: info["width"] ? Number(info["width"]) : undefined,
    height: info["height"] ? Number(info["height"]) : undefined,
    uploader: info["uploader"] ? String(info["uploader"]) : undefined,
  };
};

export const fetchMedia = async (options: FetchOptions): Promise<FetchResult> => {
  const bin = requireYtDlp(options.projectRoot);
  const { url, kind = "video", maxHeight = 1080, section } = options;

  // Each download gets its own directory: extracted media is untrusted, and
  // keeping it isolated means a hostile filename cannot collide with anything.
  const dir = join(options.destDir, keyFor(`${url}|${kind}|${maxHeight}|${section ?? ""}`));
  await mkdir(dir, { recursive: true });

  const existing = (await readdir(dir).catch(() => [])).filter((f) => !f.endsWith(".json"));
  if (existing.length > 0) {
    const path = join(dir, existing[0]!);
    const info = await probeFile(path);
    return { path, cached: true, title: info.title, durationSec: info.durationSec };
  }

  const args = [
    "--no-playlist",
    "--no-warnings",
    "--restrict-filenames",
    "-o", join(dir, "%(id)s.%(ext)s"),
  ];

  if (kind === "audio") {
    args.push("-x", "--audio-format", "mp3", "--audio-quality", "0");
  } else {
    args.push(
      "-f",
      `bestvideo[height<=${maxHeight}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${maxHeight}]/best`,
      "--merge-output-format",
      "mp4",
    );
  }

  if (section) args.push("--download-sections", section, "--force-keyframes-at-cuts");

  args.push("--", url);

  await run(bin, args, { maxBuffer: 128 * 1024 * 1024 });

  const files = (await readdir(dir)).filter((f) => !f.endsWith(".json"));
  const file = files[0];
  if (!file) throw new Error(`yt-dlp produced no file for ${url}`);

  const path = join(dir, file);
  const info = await probeFile(path);
  return { path, cached: false, title: info.title, durationSec: info.durationSec };
};

/** Probe a local file with ffprobe. */
export const probeFile = async (
  path: string,
): Promise<{ title: string; durationSec: number }> => {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1",
    path,
  ]);
  return { title: path.split("/").pop() ?? path, durationSec: Number(stdout.trim()) || 0 };
};
