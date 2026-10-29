/**
 * Offline voice, for `--mock-voice`.
 *
 * The point is not a good voiceover; it is that the entire pipeline — timing,
 * captions, transitions, render — can be exercised with no API key and no
 * spend. Layout and pacing work happens here; real synthesis happens once, at
 * the end.
 *
 * macOS `say` gives us real audio of roughly the right length. Its timings are
 * estimated rather than measured, so the audio is stretched to match the
 * estimate; captions then line up well enough to judge rhythm.
 */

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { mockAlignment } from "../core/align.ts";
import { cacheKey } from "./elevenlabs.ts";
import type { CharAlignment } from "../core/types.ts";

const run = promisify(execFile);

const WPM = 165;

const sayAvailable = async (): Promise<boolean> => {
  try {
    await run("which", ["say"]);
    return true;
  } catch {
    return false;
  }
};

/** Silent track of an exact length — the fallback when `say` is unavailable. */
const renderSilence = async (seconds: number, outPath: string): Promise<void> => {
  await run("ffmpeg", [
    "-v", "error", "-y",
    "-f", "lavfi",
    "-i", `anullsrc=channel_layout=mono:sample_rate=44100`,
    "-t", seconds.toFixed(3),
    "-c:a", "libmp3lame", "-q:a", "9",
    outPath,
  ]);
};

export const synthesizeMock = async (
  text: string,
  cacheDir: string,
): Promise<{ audioPath: string; alignment: CharAlignment; hit: boolean }> => {
  const key = cacheKey(text, "mock", `say-${WPM}`);
  const audioPath = join(cacheDir, `${key}.mock.mp3`);
  const alignment = mockAlignment(text, { wordsPerMinute: WPM });
  const targetSeconds = alignment.endTimesSeconds[alignment.endTimesSeconds.length - 1] ?? 1;

  await mkdir(dirname(audioPath), { recursive: true });

  if (await sayAvailable()) {
    // `say` infers the encoding from the extension; passing --data-format
    // explicitly fails on recent macOS, so let the .aiff suffix decide.
    const aiff = audioPath.replace(/\.mock\.mp3$/, ".mock.aiff");
    await run("say", ["-r", String(WPM), "-o", aiff, text], { maxBuffer: 1024 * 1024 });
    // Stretch/squeeze the spoken audio onto the estimated timeline so the
    // captions we generated actually match what is heard.
    const probe = await run("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1", aiff,
    ]);
    const actual = Number(probe.stdout.trim()) || targetSeconds;
    const tempo = Math.min(Math.max(actual / targetSeconds, 0.5), 2.0);
    await run("ffmpeg", [
      "-v", "error", "-y", "-i", aiff,
      "-filter:a", `atempo=${tempo.toFixed(4)}`,
      "-c:a", "libmp3lame", "-q:a", "4",
      audioPath,
    ]);
    await run("rm", ["-f", aiff]);
  } else {
    await renderSilence(targetSeconds, audioPath);
  }

  await writeFile(`${audioPath}.alignment.json`, JSON.stringify(alignment));
  return { audioPath, alignment, hit: false };
};
