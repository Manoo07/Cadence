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
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const DEFAULT_MODEL = "eleven_multilingual_v2";

/** Named voices, so scripts can say `voice: elevenlabs:Rachel`. */
const VOICE_IDS: Record<string, string> = {
  rachel: "21m00Tcm4TlvDq8ikWAM",
  adam: "pNInz6obpgDQGcFmaJgB",
  antoni: "ErXwobaYiN019PkySvjV",
  bella: "EXAVITQu4vr4xnSDxMaL",
  josh: "TxGEqnHWrfWFTfGW9XjX",
  arnold: "VR6AewLTigWG4xSOukaG",
  domi: "AZnzlk1XvdvUeBnXmlld",
  elli: "MF3mGyEYCl7XYWbV9V6O",
  sam: "yoZ06aMxZJJ28mfd3POQ",
  default: DEFAULT_VOICE,
};

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
