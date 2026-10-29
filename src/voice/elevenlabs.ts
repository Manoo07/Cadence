/**
 * ElevenLabs adapter. One of the two places in the project that does IO.
 *
 * We use /with-timestamps rather than the plain endpoint: it costs the same and
 * returns character-level alignment against the *original* text, which is what
 * the whole timing model is built on. Without it we would need a forced
 * aligner and the sync would only ever be approximate.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CharAlignment } from "../core/types.ts";

const API = "https://api.elevenlabs.io/v1";
const DEFAULT_MODEL = "eleven_multilingual_v2";

/**
 * Named voices, so a script can say `voice: elevenlabs:Alice`.
 *
 * These are all *premade* voices. The distinction matters: ElevenLabs also
 * publishes a much larger Voice Library, and library voices are rejected with
 * a 402 on the free tier. Rachel — long the canonical example in their docs —
 * is one of those, which means the obvious default is the one that cannot
 * work for anyone without a paid plan.
 *
 * Narration-friendly voices first; the rest are here so a script can name one
 * without looking up an id.
 */
const VOICE_IDS: Record<string, string> = {
  // Clear, even delivery — good for explainers.
  alice: "Xb7hH8MSUJpSbSDYk0k2",
  river: "SAz9YHcvj6GT2YYXdXww",
  matilda: "XrExE9yKIg1WjnnlVkGX",
  daniel: "onwK4e9ZLuTAKqWW03F9",
  eric: "cjVigY5qzO86Huf0OWal",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  brian: "nPczCjzI2devNBz1zQrb",
  george: "JBFqnCBsd6RMkjVDRZzb",
  // More character, for a script that wants it.
  liam: "TX3LPaxmHKxFdv7VOQHJ",
  jessica: "cgSgspJ2msm6clMCkdW9",
  laura: "FGY2WhTYpPnrIDTdsKH5",
  charlie: "IKne3meq5aSn9XLyUdCD",
  chris: "iP95p4xoKVk53GoZ742B",
  will: "bIHbv24MWmeRgasZH58o",
  roger: "CwhRBWXzGAHq8TQ4Fs17",
  bill: "pqHfZKP75CvOlQylNhV4",
  lily: "pFZP5JQG7iQjIQuC4Bku",
  callum: "N2lVS1w4EtoT3dr4eOWO",
  adam: "pNInz6obpgDQGcFmaJgB",
};

/** Alice: clear, even, built for explanation. Works on every tier. */
const DEFAULT_VOICE = VOICE_IDS["alice"]!;

export type VoiceRequest = {
  readonly text: string;
  /** "elevenlabs:Rachel", a raw voice id, or "" for the default. */
  readonly voice: string;
  readonly modelId?: string;
  readonly apiKey: string;
};

export type VoiceResult = {
  readonly audio: Buffer;
  readonly alignment: CharAlignment;
};

export const resolveVoiceId = (voice: string): string => {
  const bare = voice.replace(/^elevenlabs:/i, "").trim();
  if (bare === "") return DEFAULT_VOICE;
  const named = VOICE_IDS[bare.toLowerCase()];
  if (named) return named;
  // Anything else is assumed to already be a voice id.
  return bare;
};

type ElevenAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

type ElevenResponse = {
  audio_base64: string;
  alignment: ElevenAlignment | null;
  normalized_alignment: ElevenAlignment | null;
};

/**
 * `alignment` indexes the text we sent; `normalized_alignment` indexes the text
 * after the engine expands things like "$50" to "fifty dollars". Scene spans
 * were measured against what we sent, so we must prefer `alignment` — using the
 * normalised one would silently shift every scene boundary.
 */
const pickAlignment = (res: ElevenResponse): CharAlignment => {
  const a = res.alignment ?? res.normalized_alignment;
  if (!a) throw new Error("ElevenLabs returned no alignment data.");
  return {
    characters: a.characters,
    startTimesSeconds: a.character_start_times_seconds,
    endTimesSeconds: a.character_end_times_seconds,
  };
};

export const synthesize = async (req: VoiceRequest): Promise<VoiceResult> => {
  const voiceId = resolveVoiceId(req.voice);
  const url = `${API}/text-to-speech/${voiceId}/with-timestamps`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": req.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: req.text,
      model_id: req.modelId ?? DEFAULT_MODEL,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.15,
        use_speaker_boost: true,
      },
      // Numbers and symbols are spoken out; keeps `alignment` usable.
      apply_text_normalization: "auto",
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    // A 402 on a voice is almost always a library voice on a free plan, and
    // the raw payload does not make the fix obvious. Say what to do instead.
    if (response.status === 402 && /library_voice|paid_plan_required/.test(body)) {
      throw new Error(
        `This voice is not available on your ElevenLabs plan.\n` +
          `  Voice Library voices need a paid plan; premade voices work on every tier.\n` +
          `  Try one of: ${Object.keys(VOICE_IDS).slice(0, 8).join(", ")}\n` +
          `  Set it in your script's frontmatter, e.g.  voice: elevenlabs:Alice`,
      );
    }

    throw new Error(
      `ElevenLabs ${response.status} ${response.statusText}${body ? `: ${body.slice(0, 400)}` : ""}`,
    );
  }

  const json = (await response.json()) as ElevenResponse;
  return {
    audio: Buffer.from(json.audio_base64, "base64"),
    alignment: pickAlignment(json),
  };
};

// ------------------------------------------------------------------ caching

/**
 * Synthesis is the only part of the pipeline that costs money, and it is
 * perfectly deterministic for a given (text, voice, model). Cache on a hash of
 * those three so re-running the pipeline after a layout tweak is free.
 */
export const cacheKey = (text: string, voice: string, model: string): string =>
  createHash("sha256").update(`${voice}\u0000${model}\u0000${text}`).digest("hex").slice(0, 32);

export type CachedVoice = { audioPath: string; alignmentPath: string; hit: boolean };

export const synthesizeCached = async (
  req: VoiceRequest,
  cacheDir: string,
): Promise<CachedVoice> => {
  const model = req.modelId ?? DEFAULT_MODEL;
  const key = cacheKey(req.text, resolveVoiceId(req.voice), model);
  const audioPath = join(cacheDir, `${key}.mp3`);
  const alignmentPath = join(cacheDir, `${key}.alignment.json`);

  try {
    await readFile(audioPath);
    await readFile(alignmentPath);
    return { audioPath, alignmentPath, hit: true };
  } catch {
    // not cached
  }

  const result = await synthesize(req);
  await mkdir(dirname(audioPath), { recursive: true });
  await writeFile(audioPath, result.audio);
  await writeFile(alignmentPath, JSON.stringify(result.alignment));
  return { audioPath, alignmentPath, hit: false };
};
