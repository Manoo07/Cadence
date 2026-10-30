/**
 * Validation. Pure.
 *
 * The output is a JSON report, not console prose, because the intended reader
 * is an agent in a fix-and-retry loop as much as a person. Every issue carries
 * a code, a scene, a path and a hint, so a caller can act on it without
 * parsing English.
 *
 * The checks that matter are the ones a script author cannot see: text that
 * will overflow its box, content hidden behind the captions, a scene so dense
 * the viewer cannot read it in the time the narration allows.
 */

import { issue, type Issue } from "./result.ts";
import type { VideoSpec } from "./types.ts";

export type ValidationReport = {
  readonly ok: boolean;
  readonly errors: number;
  readonly warnings: number;
  readonly issues: readonly Issue[];
};

/**
 * Approximate rendered width of a string, in px.
 *
 * A real text measurement needs a browser; this is a per-character average
 * calibrated for the pack's faces. It is deliberately slightly pessimistic,
 * because a false warning costs a second and a missed overflow costs a render.
 */
const estimateWidth = (text: string, fontSize: number, mono: boolean): number => {
  const ratio = mono ? 0.6 : 0.52;
  return text.length * fontSize * ratio;
};

/** Words per second the narration is actually delivering over a scene. */
const speakingRate = (words: number, frames: number, fps: number): number =>
  words / Math.max(0.1, frames / fps);

export type ValidateOptions = {
  /** Layout names that exist in the registry. */
  readonly knownLayouts: readonly string[];
  /** Custom component names the project registered. */
  readonly knownComponents?: readonly string[];
  /** Per-scene prop validation, injected so core stays free of zod schemas. */
  readonly checkProps?: (
    layout: string,
    props: Record<string, unknown>,
  ) => { ok: true } | { ok: false; errors: { path: string; message: string }[] };
  /** Asset paths that exist on disk, for image/music references. */
  readonly existingAssets?: readonly string[];
};

export const validate = (spec: VideoSpec, options: ValidateOptions): ValidationReport => {
  const issues: Issue[] = [];
  const { format } = spec;
  const scale = format.width / 1080;

  if (spec.scenes.length === 0) {
    issues.push(issue("spec.empty", "The video has no scenes."));
  }

  // --- global pacing -------------------------------------------------------

  const seconds = spec.durationInFrames / format.fps;
  if (seconds > 180) {
    issues.push(
      issue("pacing.too-long", `The video is ${Math.round(seconds)}s.`, {
        severity: "warning",
        hint: "Vertical explainers hold attention best under ~2 minutes. Consider splitting it.",
      }),
    );
  }

  spec.scenes.forEach((scene, index) => {
    const path = `scenes.${index}`;
    const sceneSeconds = scene.durationInFrames / format.fps;

    // --- layout exists -----------------------------------------------------

    if (!options.knownLayouts.includes(scene.layout)) {
      issues.push(
        issue("layout.unknown", `Unknown layout "${scene.layout}".`, {
          scene: scene.id,
          path: `${path}.layout`,
          hint: `Available layouts: ${options.knownLayouts.join(", ")}`,
        }),
      );
      return;
    }

    // --- props type-check --------------------------------------------------

    if (options.checkProps) {
      const result = options.checkProps(scene.layout, scene.props as Record<string, unknown>);
      if (!result.ok) {
        for (const e of result.errors) {
          issues.push(
            issue("props.invalid", `${scene.layout}: ${e.message}`, {
              scene: scene.id,
              path: `${path}.props${e.path ? `.${e.path}` : ""}`,
              hint: "Fix the prop in script.md, then re-run `video build`.",
            }),
          );
        }
      }
    }

    // --- custom component is registered ------------------------------------

    if (scene.layout === "custom") {
      const name = (scene.props as { component?: string }).component;
      if (name && options.knownComponents && !options.knownComponents.includes(name)) {
        issues.push(
          issue("custom.unregistered", `Component "${name}" is not registered.`, {
            scene: scene.id,
            path: `${path}.props.component`,
            hint: `Register it in projects/<name>/scenes/index.ts. Known: ${
              options.knownComponents.join(", ") || "(none)"
            }`,
          }),
        );
      }
    }

    // --- pacing ------------------------------------------------------------

    if (sceneSeconds < 1.2) {
      issues.push(
        issue("pacing.scene-too-short", `Scene is only ${sceneSeconds.toFixed(1)}s.`, {
          scene: scene.id,
          path,
          severity: "warning",
          hint: "Too fast to read. Lengthen the narration or add `> hold: 800`.",
        }),
      );
    }
    if (sceneSeconds > 14) {
      issues.push(
        issue("pacing.scene-too-long", `Scene runs ${sceneSeconds.toFixed(1)}s.`, {
          scene: scene.id,
          path,
          severity: "warning",
          hint: "One visual held this long goes flat. Split it into two scenes.",
        }),
      );
    }

    const wordsHere = spec.captions.filter((w) => {
      const f = (w.startMs / 1000) * format.fps;
      return f >= scene.startFrame && f < scene.startFrame + scene.durationInFrames;
    }).length;

    if (wordsHere > 0) {
      const rate = speakingRate(wordsHere, scene.durationInFrames, format.fps);
      if (rate > 4.2) {
        issues.push(
          issue("pacing.rushed", `Narration runs at ${rate.toFixed(1)} words/sec.`, {
            scene: scene.id,
            path,
            severity: "warning",
            hint: "Above ~4 w/s is hard to follow. Shorten the line or split the scene.",
          }),
        );
      }
    }

    // --- density -----------------------------------------------------------

    const density = countElements(scene.props as Record<string, unknown>);
    const budget = Math.ceil(sceneSeconds * 1.6);
    if (density > budget && density > 4) {
      issues.push(
        issue(
          "density.overloaded",
          `${density} elements in ${sceneSeconds.toFixed(1)}s (budget ~${budget}).`,
          {
            scene: scene.id,
            path,
            severity: "warning",
            hint: "The viewer cannot read this many items in the time available. Cut items or lengthen the narration.",
          },
        ),
      );
    }

    // --- text overflow -----------------------------------------------------

    const available = format.width - format.safe.left - format.safe.right;
    for (const { key, size, mono, lines } of textFields(scene.layout)) {
      const value = (scene.props as Record<string, unknown>)[key];
      if (typeof value !== "string") continue;
      const width = estimateWidth(value, size * scale, mono);
      if (width > available * lines) {
        const perChar = size * scale * (mono ? 0.6 : 0.52);
        const fits = Math.floor((available * lines) / perChar);
        issues.push(
          issue("text.overflow", `"${truncate(value)}" will not fit.`, {
            scene: scene.id,
            path: `${path}.props.${key}`,
            hint: `About ${fits} characters fit here; this is ${value.length}. Shorten it.`,
          }),
        );
      }
    }
  });

  // --- assets --------------------------------------------------------------

  if (options.existingAssets) {
    const referenced = new Set<string>();
    for (const scene of spec.scenes) {
      const image = (scene.props as { image?: string }).image;
      if (image) referenced.add(image);
    }
    if (spec.audio.music) referenced.add(spec.audio.music);

    for (const asset of referenced) {
      if (!options.existingAssets.includes(asset)) {
        issues.push(
          issue("asset.missing", `Asset not found: ${asset}`, {
            hint: `Place it under the project's public/ directory, or remove the reference.`,
          }),
        );
      }
    }
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  return { ok: errors === 0, errors, warnings, issues };
};

const truncate = (s: string, n = 48): string => (s.length <= n ? s : `${s.slice(0, n)}…`);

/** Rough count of discrete things the viewer must read in a scene. */
const countElements = (props: Record<string, unknown>): number => {
  let n = 0;
  for (const value of Object.values(props)) {
    if (Array.isArray(value)) n += value.length;
    else if (typeof value === "string" && value.length > 0) n += 1;
  }
  return n;
};

/**
 * Which props hold user-visible text: at what size, in which face, and how
 * many lines that field is allowed to wrap to before it is a problem.
 *
 * The line budget is the part that needs care. A hero title is *meant* to wrap
 * — three lines of display type is the look — whereas a mono chip that wraps
 * at all has broken its row. Getting this wrong in either direction makes the
 * validator useless: too tight and every real title is flagged, too loose and
 * nothing is.
 */
type TextField = { key: string; size: number; mono: boolean; lines: number };

const textFields = (layout: string): TextField[] => {
  const common: TextField[] = [
    { key: "headline", size: 64, mono: false, lines: 2 },
    { key: "caption", size: 44, mono: false, lines: 2 },
    // Window-chrome titles sit in a fixed bar and cannot wrap.
    { key: "title", size: 32, mono: true, lines: 1 },
    { key: "badge", size: 24, mono: true, lines: 1 },
    { key: "eyebrow", size: 24, mono: true, lines: 1 },
    { key: "subtitle", size: 44, mono: false, lines: 2 },
  ];
  switch (layout) {
    case "title":
      // The title layout scales display type down as the statement grows, so
      // the effective size here mirrors that curve rather than the base 132.
      return [{ key: "text", size: 132 * 0.54, mono: false, lines: 3 }, ...common];
    case "quote":
      return [
        { key: "text", size: 96, mono: false, lines: 4 },
        { key: "attribution", size: 32, mono: true, lines: 1 },
      ];
    default:
      return common;
  }
};
