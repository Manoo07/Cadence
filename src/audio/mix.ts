/**
 * Audio mixing.
 *
 * Remotion can play a music bed at a fixed volume, but a fixed bed is exactly
 * what makes an explainer tiring: it either buries the voice or sits there as
 * noise. Real sidechain ducking — the music stepping back whenever the
 * narrator speaks and swelling in the gaps — is what makes a video sound
 * produced rather than assembled.
 *
 * ffmpeg does this properly, so the bed is pre-mixed into a single track here
 * and the composition plays one file.
 */

import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export type MixOptions = {
  readonly voiceoverPath: string;
  readonly musicPath?: string;
  readonly outPath: string;
  /** Music level relative to full scale, before ducking. */
  readonly musicGainDb?: number;
  /** How far the music drops while the narrator speaks. */
  readonly duckRatio?: number;
  /** Sound effects to lay in, at absolute times. */
  readonly sfx?: readonly { path: string; atMs: number; gainDb?: number }[];
  /** Integrated loudness target. -14 LUFS is the social-platform convention. */
  readonly targetLufs?: number;
};

export const durationSeconds = async (path: string): Promise<number> => {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1",
    path,
  ]);
  return Number(stdout.trim()) || 0;
};

/**
 * Mix narration, an optional ducked music bed, and optional one-shot effects
 * into a single track the composition can play.
 *
 * The narration is also the sidechain key, so ducking follows the actual
 * speech envelope rather than a schedule — pauses for breath open the bed back
 * up on their own.
 */
export const mix = async (options: MixOptions): Promise<string> => {
  const {
    voiceoverPath,
    musicPath,
    outPath,
    musicGainDb = -22,
    duckRatio = 8,
    sfx = [],
    targetLufs = -14,
  } = options;

  await mkdir(dirname(outPath), { recursive: true });

  // Nothing to mix: the narration already is the track.
  if (!musicPath && sfx.length === 0) {
    await run("ffmpeg", ["-v", "error", "-y", "-i", voiceoverPath, "-c:a", "libmp3lame", "-q:a", "2", outPath]);
    return normalizeLoudness(outPath, targetLufs);
  }

  const voSeconds = await durationSeconds(voiceoverPath);
  const inputs: string[] = ["-i", voiceoverPath];
  const filters: string[] = [];
  const mixLabels: string[] = [];

  // The voice is used twice: once as the audible track, once as the key that
  // drives the compressor on the music.
  filters.push("[0:a]asplit=2[vo][key]");
  mixLabels.push("[vo]");

  if (musicPath) {
    inputs.push("-stream_loop", "-1", "-i", musicPath);
    const gain = 10 ** (musicGainDb / 20);
    filters.push(
      `[1:a]volume=${gain.toFixed(4)},atrim=0:${voSeconds.toFixed(3)},afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(0, voSeconds - 1.8).toFixed(3)}:d=1.8[bed]`,
      // threshold/ratio/attack/release tuned for speech: fast enough to catch
      // the first syllable, slow enough not to pump between words.
      `[bed][key]sidechaincompress=threshold=0.05:ratio=${duckRatio}:attack=12:release=420:makeup=1[ducked]`,
    );
    mixLabels.push("[ducked]");
  }

  sfx.forEach((effect, i) => {
    const index = inputs.filter((a) => a === "-i").length;
    inputs.push("-i", effect.path);
    const gain = 10 ** ((effect.gainDb ?? -12) / 20);
    filters.push(
      `[${index}:a]volume=${gain.toFixed(4)},adelay=${Math.round(effect.atMs)}|${Math.round(effect.atMs)}[sfx${i}]`,
    );
    mixLabels.push(`[sfx${i}]`);
  });

  filters.push(
    `${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=0:normalize=0[out]`,
  );

  await run(
    "ffmpeg",
    [
      "-v", "error", "-y",
      ...inputs,
      "-filter_complex", filters.join(";"),
      "-map", "[out]",
      "-c:a", "libmp3lame", "-q:a", "2",
      outPath,
    ],
    { maxBuffer: 32 * 1024 * 1024 },
  );

  return normalizeLoudness(outPath, targetLufs);
};

/**
 * Normalise to a target loudness, in two passes.
 *
 * Single-pass `loudnorm` works from a running estimate and can land many dB
 * from its own target — a mix asking for -16 measured -23 in practice, which
 * on a social feed means the video is simply quieter than everything around
 * it. Measuring first and then correcting with those numbers is accurate to a
 * fraction of a dB.
 *
 * -14 LUFS is what Instagram, TikTok and YouTube normalise toward; sitting at
 * that level means the platform leaves the audio alone.
 */
export const normalizeLoudness = async (
  path: string,
  targetLufs = -14,
): Promise<string> => {
  const measure = `loudnorm=I=${targetLufs}:TP=-1.0:LRA=11:print_format=json`;
  const { stderr } = await run(
    "ffmpeg",
    ["-hide_banner", "-i", path, "-af", measure, "-f", "null", "-"],
    { maxBuffer: 32 * 1024 * 1024 },
  ).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));

  const json = /\{[\s\S]*?"target_offset"[\s\S]*?\}/.exec(stderr ?? "");
  if (!json) return path; // Could not measure; leave the mix as it is.

  const m = JSON.parse(json[0]) as Record<string, string>;
  const corrected =
    `loudnorm=I=${targetLufs}:TP=-1.0:LRA=11` +
    `:measured_I=${m["input_i"]}:measured_TP=${m["input_tp"]}` +
    `:measured_LRA=${m["input_lra"]}:measured_thresh=${m["input_thresh"]}` +
    `:offset=${m["target_offset"]}:linear=true:print_format=summary`;

  const tmp = `${path}.norm.mp3`;
  await run(
    "ffmpeg",
    ["-v", "error", "-y", "-i", path, "-af", corrected, "-ar", "48000", "-c:a", "libmp3lame", "-q:a", "2", tmp],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  await run("mv", [tmp, path]);
  return path;
};
