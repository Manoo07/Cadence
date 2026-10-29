/**
 * The data model. Five shapes, one direction of flow:
 *
 *   Script  ->  Word[]  ->  SceneTiming[]  ->  Timeline  ->  VideoSpec
 *
 * Everything here is plain data: serialisable, immutable, no behaviour.
 */

// ---------------------------------------------------------------- formats

export type FormatName = "9x16" | "16x9" | "1x1";

export type Format = {
  readonly name: FormatName;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  /** Regions no scene content may occupy, in px. */
  readonly safe: {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
  };
};

export const FORMATS: Readonly<Record<FormatName, Format>> = {
  "9x16": {
    name: "9x16",
    width: 1080,
    height: 1920,
    fps: 30,
    // The bottom band is the caption zone. It is sized to two lines of caption
    // plus breathing room — larger than that and scenes float in dead space
    // well above the text, which reads as a layout mistake rather than as
    // deliberate negative space.
    safe: { top: 180, bottom: 430, left: 72, right: 72 },
  },
  "16x9": {
    name: "16x9",
    width: 1920,
    height: 1080,
    fps: 30,
    safe: { top: 96, bottom: 240, left: 120, right: 120 },
  },
  "1x1": {
    name: "1x1",
    width: 1080,
    height: 1080,
    fps: 30,
    safe: { top: 120, bottom: 320, left: 72, right: 72 },
  },
};

// ---------------------------------------------------------------- script

/** A scene as written by the author, before any timing is known. */
export type ScriptScene = {
  readonly id: string;
  /** Shown top-left, e.g. "07 — rag". */
  readonly label: string;
  /** Layout name from the registry, e.g. "pipeline". */
  readonly layout: string;
  readonly props: Readonly<Record<string, unknown>>;
  /** Narration with markdown emphasis markers stripped. This is what is spoken. */
  readonly narration: string;
  /** Character offsets of `narration` within the concatenated voiceover text. */
  readonly span: CharSpan;
  /** Words the author marked with **bold**, as offsets into the full VO text. */
  readonly emphasis: readonly CharSpan[];
  readonly options: SceneOptions;
};

export type CharSpan = { readonly start: number; readonly end: number };

export type SceneOptions = {
  /** Transition *into* this scene. */
  readonly transition?: TransitionName;
  readonly transitionMs?: number;
  /** Seconds of silence held after the narration, for the visual to breathe. */
  readonly holdMs?: number;
  /** Disable the automatic camera push-in. */
  readonly camera?: "push" | "pull" | "drift" | "none";
};

/**
 * Transitions verified against @remotion/transitions 4.0.539.
 *
 * The DOM set renders through plain CSS and is safe in headless Chrome, so it is
 * the default vocabulary. The shader set is WebGL ("html in canvas") and is
 * gated behind `allowShaderTransitions` in the style pack, because a GL failure
 * during a long render is expensive to discover late.
 */
export const DOM_TRANSITIONS = [
  "cut",
  "none",
  "fade",
  "slide",
  "wipe",
  "flip",
  "clockWipe",
  "iris",
  "pushCut",
] as const;

export const SHADER_TRANSITIONS = [
  "dissolve",
  "crossZoom",
  "dreamyZoom",
  "zoomInOut",
  "blurSlide",
  "filmBurn",
  "swap",
  "ripple",
  "linearBlur",
  "zoomBlur",
  "bookFlip",
  "crosswarp",
] as const;

export type DomTransition = (typeof DOM_TRANSITIONS)[number];
export type ShaderTransition = (typeof SHADER_TRANSITIONS)[number];
export type TransitionName = DomTransition | ShaderTransition;

export type ScriptMeta = {
  readonly title: string;
  readonly voice: string;
  readonly style: string;
  readonly format: FormatName;
  readonly music?: string;
  readonly musicGainDb?: number;
  readonly captions?: CaptionTheme;
};

export type CaptionTheme = "selection" | "karaoke" | "block" | "none";

export type Script = {
  readonly meta: ScriptMeta;
  readonly scenes: readonly ScriptScene[];
  /** All narration concatenated — exactly the string sent to the TTS engine. */
  readonly voiceoverText: string;
};

// ---------------------------------------------------------------- alignment

/** One spoken word with its timing, as recovered from the TTS alignment. */
export type Word = {
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
  /** Offset of this word in the voiceover text — how words map back to scenes. */
  readonly span: CharSpan;
};

/** Character-level alignment, the raw shape TTS engines return. */
export type CharAlignment = {
  readonly characters: readonly string[];
  readonly startTimesSeconds: readonly number[];
  readonly endTimesSeconds: readonly number[];
};

/** A scene's position on the real timeline, derived from the audio. */
export type SceneTiming = {
  readonly id: string;
  readonly startFrame: number;
  readonly durationInFrames: number;
  /** Frames (relative to scene start) when emphasised words are spoken. */
  readonly beats: readonly number[];
};

// ---------------------------------------------------------------- spec

/** The compiled artefact: `video.json`. This is what the renderer consumes. */
export type VideoSpec = {
  readonly version: 1;
  readonly meta: ScriptMeta;
  readonly format: Format;
  readonly durationInFrames: number;
  readonly audio: {
    readonly voiceover: string;
    readonly music?: string;
    readonly musicGainDb: number;
  };
  readonly scenes: readonly SpecScene[];
  readonly captions: readonly Word[];
};

export type SpecScene = {
  readonly id: string;
  readonly label: string;
  readonly layout: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly startFrame: number;
  readonly durationInFrames: number;
  readonly beats: readonly number[];
  readonly options: SceneOptions;
};
