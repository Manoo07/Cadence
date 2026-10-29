/**
 * The voice facade. Callers ask for narration; whether it came from
 * ElevenLabs, the cache, or the offline mock is not their concern.
 */

import { readFile } from "node:fs/promises";
import { toWords } from "../core/align.ts";
import type { CharAlignment, Word } from "../core/types.ts";
import { synthesizeCached } from "./elevenlabs.ts";
import { synthesizeMock } from "./mock.ts";
import { alignAudioToScript, whisperAvailable, type WhisperModel } from "./whisper.ts";

export { resolveVoiceId, synthesize, synthesizeCached, cacheKey } from "./elevenlabs.ts";
export { synthesizeMock } from "./mock.ts";
export { transcribe, alignAudioToScript, whisperAvailable } from "./whisper.ts";
export type { WhisperModel, Transcript } from "./whisper.ts";

/** Where a narration's word timings came from. */
export type TimingSource = "elevenlabs" | "whisper" | "mock";

export type NarrateOptions = {
  readonly text: string;
  readonly voice: string;
  readonly cacheDir: string;
  readonly mock?: boolean;
  readonly apiKey?: string;
  readonly modelId?: string;
  /**
   * An existing recording to use instead of synthesising. When set, timings
   * come from Whisper rather than from a TTS engine — this is how a human
   * voiceover, or audio pulled out of a video, drives the same pipeline.
   */
  readonly audioPath?: string;
  readonly whisperModel?: WhisperModel;
  readonly projectRoot: string;
};

export type Narration = {
  readonly audioPath: string;
  readonly words: readonly Word[];
  readonly cached: boolean;
  readonly source: TimingSource;
  /** Only meaningful for Whisper: how much of the script got a real anchor. */
  readonly coverage?: number;
};

export const narrate = async (options: NarrateOptions): Promise<Narration> => {
  // An existing recording: Whisper decides the timing, the script decides the words.
  if (options.audioPath) {
    if (!whisperAvailable(options.projectRoot)) {
      throw new Error(
        "Whisper is required to time an existing recording, but .venv-media is missing.\n" +
          "  uv venv .venv-media --python 3.12\n" +
          "  uv pip install --python .venv-media faster-whisper yt-dlp",
      );
    }
    const aligned = await alignAudioToScript(options.text, {
      audioPath: options.audioPath,
      model: options.whisperModel ?? "base",
      projectRoot: options.projectRoot,
    });
    return {
      audioPath: options.audioPath,
      words: aligned.words,
      cached: false,
      source: "whisper",
      coverage: aligned.coverage,
    };
  }

  if (options.mock) {
    const r = await synthesizeMock(options.text, options.cacheDir);
    return {
      audioPath: r.audioPath,
      words: toWords(r.alignment),
      cached: r.hit,
      source: "mock",
    };
  }

  const apiKey = options.apiKey ?? process.env["ELEVENLABS_API_KEY"] ?? "";
  if (apiKey === "") {
    throw new Error(
      "ELEVENLABS_API_KEY is not set. Add it to .env, use --mock-voice to work offline, " +
        "or pass --audio <file> to time an existing recording with Whisper.",
    );
  }

  const r = await synthesizeCached(
    {
      text: options.text,
      voice: options.voice,
      apiKey,
      modelId: options.modelId ?? process.env["ELEVENLABS_MODEL_ID"],
    },
    options.cacheDir,
  );

  const alignment = JSON.parse(await readFile(r.alignmentPath, "utf8")) as CharAlignment;
  return {
    audioPath: r.audioPath,
    words: toWords(alignment),
    cached: r.hit,
    source: "elevenlabs",
  };
};
