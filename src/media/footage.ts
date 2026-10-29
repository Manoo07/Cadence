/**
 * Preparing downloaded footage for use in a scene.
 *
 * Raw footage is almost never the right shape: it is 16:9 when the video is
 * 9:16, it is three minutes long when the scene is six seconds, it carries
 * audio that would fight the narration. These are the ffmpeg operations that
 * turn a clip into something a scene can drop in without further thought.
 */

import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import type { Format } from "../core/types.ts";

const run = promisify(execFile);

export type PrepareOptions = {
  readonly inputPath: string;
  readonly outPath: string;
  readonly format: Format;
  /** Seconds into the source to start. */
  readonly startSec?: number;
  /** How much to keep. Defaults to the whole remaining clip. */
  readonly durationSec?: number;
  /**
   * How to reconcile the clip's aspect with the video's.
   *   cover   fill the frame, cropping the overflow (the usual choice)
   *   contain fit the whole frame inside, padding with the page colour
   *   blur    fit inside, filling the margins with a blurred copy
   */
  readonly fit?: "cover" | "contain" | "blur";
  /** Background for `contain`. */
  readonly padColor?: string;
  /** Keep the clip's own audio. Off by default: narration owns the audio. */
  readonly keepAudio?: boolean;
  readonly fps?: number;
};

const filterFor = (fit: NonNullable<PrepareOptions["fit"]>, w: number, h: number, pad: string): string => {
  switch (fit) {
    case "contain":
      return `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:${pad},setsar=1`;
    case "blur":
      // A blurred, scaled-up copy behind the clip. Reads far better than flat
      // bars when a landscape source has to live in a vertical frame.
      return (
        `split=2[bg][fg];` +
        `[bg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},gblur=sigma=28[bgb];` +
        `[fg]scale=${w}:${h}:force_original_aspect_ratio=decrease[fgs];` +
        `[bgb][fgs]overlay=(W-w)/2:(H-h)/2,setsar=1`
      );
    default:
      return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;
  }
};

/** Normalise a clip to the video's dimensions, frame rate and length. */
export const prepareFootage = async (options: PrepareOptions): Promise<string> => {
  const {
    inputPath,
    outPath,
    format,
    startSec = 0,
    durationSec,
    fit = "cover",
    padColor = "#FBF8F5",
    keepAudio = false,
    fps,
  } = options;

  await mkdir(dirname(outPath), { recursive: true });

  const args = ["-v", "error", "-y"];
  // Seeking before -i is the fast path; ffmpeg jumps rather than decoding through.
  if (startSec > 0) args.push("-ss", startSec.toFixed(3));
  args.push("-i", inputPath);
  if (durationSec) args.push("-t", durationSec.toFixed(3));

  const vf = filterFor(fit, format.width, format.height, padColor);
  args.push(
    fit === "blur" ? "-filter_complex" : "-vf",
    vf,
    "-r", String(fps ?? format.fps),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
  );

  if (keepAudio) args.push("-c:a", "aac", "-b:a", "128k");
  else args.push("-an");

  args.push(outPath);

  await run("ffmpeg", args, { maxBuffer: 64 * 1024 * 1024 });
  return outPath;
};

/** Pull a single frame, for a poster image or a still reference. */
export const extractFrame = async (
  inputPath: string,
  outPath: string,
  atSec: number,
): Promise<string> => {
  await mkdir(dirname(outPath), { recursive: true });
  await run("ffmpeg", [
    "-v", "error", "-y",
    "-ss", atSec.toFixed(3),
    "-i", inputPath,
    "-frames:v", "1",
    "-q:v", "2",
    outPath,
  ]);
  return outPath;
};

/** Extract the soundtrack, for transcription or for use as a bed. */
export const extractAudio = async (inputPath: string, outPath: string): Promise<string> => {
  await mkdir(dirname(outPath), { recursive: true });
  await run("ffmpeg", [
    "-v", "error", "-y",
    "-i", inputPath,
    "-vn",
    "-c:a", "libmp3lame", "-q:a", "2",
    outPath,
  ], { maxBuffer: 64 * 1024 * 1024 });
  return outPath;
};
