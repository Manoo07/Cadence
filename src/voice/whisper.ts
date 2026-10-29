/**
 * Whisper adapter.
 *
 * ElevenLabs timings are exact and free when we synthesised the audio
 * ourselves, so they stay the default. Whisper exists for everything else:
 * a voiceover someone recorded, audio lifted from an existing video, a
 * different TTS provider. It decouples the project from one vendor, which is
 * the point.
 *
 * Whisper reports what it *heard*, not what the script says, so its words are
 * run through `transferTimings` to land back on the script text. See
 * `core/transfer.ts` for why that matters.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { transferCoverage, transferTimings, type TimedWord } from "../core/transfer.ts";
import type { Word } from "../core/types.ts";

const run = promisify(execFile);

export type WhisperModel = "tiny" | "base" | "small" | "medium" | "large-v3";

export type TranscribeOptions = {
  readonly audioPath: string;
  readonly model?: WhisperModel;
  readonly language?: string;
  /**
   * The script, when we have one. Passed to Whisper as an initial prompt,
   * which measurably improves how it renders proper nouns and jargon — and
   * better transcription means more anchor points for the timing transfer.
   */
  readonly prompt?: string;
  readonly projectRoot: string;
};

export type Transcript = {
  readonly words: readonly TimedWord[];
  readonly language: string;
  readonly durationMs: number;
};

type SidecarResult = {
  words?: TimedWord[];
  language?: string;
  durationMs?: number;
  error?: string;
};

/** Path to the media venv's interpreter, which holds faster-whisper and yt-dlp. */
export const mediaPython = (projectRoot: string): string =>
  join(projectRoot, ".venv-media", "bin", "python");

export const whisperAvailable = (projectRoot: string): boolean =>
  existsSync(mediaPython(projectRoot));

export const transcribe = async (options: TranscribeOptions): Promise<Transcript> => {
  const python = mediaPython(options.projectRoot);
  if (!existsSync(python)) {
    throw new Error(
      "Whisper is not installed. Run:\n" +
        "  uv venv .venv-media --python 3.12\n" +
        "  uv pip install --python .venv-media faster-whisper yt-dlp",
    );
  }

  const args = [
    join(options.projectRoot, "scripts", "transcribe.py"),
    options.audioPath,
    "--model",
    options.model ?? "base",
  ];
  if (options.language) args.push("--lang", options.language);
  // Whisper caps the prompt, and only the opening is useful for priming.
  if (options.prompt) args.push("--prompt", options.prompt.slice(0, 850));

  const { stdout } = await run(python, args, { maxBuffer: 128 * 1024 * 1024 });
  const result = JSON.parse(stdout) as SidecarResult;
  if (result.error) throw new Error(result.error);

  return {
    words: result.words ?? [],
    language: result.language ?? "en",
    durationMs: result.durationMs ?? 0,
  };
};

export type AlignResult = {
  readonly words: readonly Word[];
  /** Fraction of script words that got a real anchor, 0–1. */
  readonly coverage: number;
  readonly language: string;
};

/**
 * Transcribe `audioPath` and transfer the timings onto `scriptText`.
 *
 * Coverage is reported rather than enforced: a low number means the audio and
 * the script have drifted apart, which is worth telling the user about but is
 * not necessarily fatal — the interpolation still produces a usable timeline.
 */
export const alignAudioToScript = async (
  scriptText: string,
  options: TranscribeOptions,
): Promise<AlignResult> => {
  const transcript = await transcribe({ ...options, prompt: options.prompt ?? scriptText });
  return {
    words: transferTimings(scriptText, transcript.words),
    coverage: transferCoverage(scriptText, transcript.words),
    language: transcript.language,
  };
};
