/**
 * parseScript — markdown in, Script out. Pure.
 *
 * The format is deliberately small, because an LLM has to produce it reliably:
 *
 *   ---                        frontmatter (yaml-ish, flat key: value)
 *   title: What is RAG?
 *   ---
 *
 *   ## 01 - the problem        a scene; the heading becomes the on-screen label
 *   :: stack { items: ["MODEL"], active: 0 }     layout + props (JSON5-ish)
 *   > transition: slide        scene options
 *   Every company wants its **own AI**.          narration; ** marks an emphasis beat
 *
 * The one subtle job here is bookkeeping: as narration is collected it is also
 * concatenated into `voiceoverText`, and every scene records the character span
 * it occupies in that string. Those spans are what let timings come back from
 * the TTS alignment and land on the right scene.
 */

import { err, issue, ok, type Issue, type Result } from "./result.ts";
import {
  FORMATS,
  type CaptionTheme,
  type CharSpan,
  type FormatName,
  type Script,
  type ScriptMeta,
  type ScriptScene,
  type SceneOptions,
  type TransitionName,
} from "./types.ts";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Flat `key: value` pairs. Deliberately not full YAML — fewer ways to get it wrong. */
const parseFrontmatter = (raw: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    let value = trimmed.slice(colon + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
};

/**
 * Props are written as a relaxed JSON object so the script stays readable:
 * unquoted keys and trailing commas are allowed, single quotes are not.
 */
const parseProps = (
  raw: string,
  sceneId: string,
): Result<Record<string, unknown>, Issue> => {
  const text = raw.trim();
  if (text === "") return ok({});
  const normalised = text
    // quote bare keys:  { items: [..] }  ->  { "items": [..] }
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    // drop trailing commas before } or ]
    .replace(/,(\s*[}\]])/g, "$1");
  try {
    const parsed: unknown = JSON.parse(normalised);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return err(
        issue("props.not-object", `Scene "${sceneId}": props must be an object.`, {
          scene: sceneId,
          hint: 'Write props as { key: value }, e.g. :: title { text: "Hello" }',
        }),
      );
    }
    return ok(parsed as Record<string, unknown>);
  } catch (e) {
    return err(
      issue(
        "props.invalid-json",
        `Scene "${sceneId}": could not parse props — ${(e as Error).message}`,
        {
          scene: sceneId,
          hint: "Props must be JSON-like: double-quoted strings, no single quotes.",
        },
      ),
    );
  }
};

const parseSceneOptions = (lines: readonly string[]): SceneOptions => {
  const opts: {
    transition?: TransitionName;
    transitionMs?: number;
    holdMs?: number;
    camera?: SceneOptions["camera"];
  } = {};
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    switch (key) {
      case "transition":
        opts.transition = value as TransitionName;
        break;
      case "transitionMs":
      case "transitionDuration": {
        const n = Number(value);
        if (Number.isFinite(n)) opts.transitionMs = n;
        break;
      }
      case "hold":
      case "holdMs": {
        const n = Number(value);
        if (Number.isFinite(n)) opts.holdMs = n;
        break;
      }
      case "camera":
        opts.camera = value as SceneOptions["camera"];
        break;
      default:
        break;
    }
  }
  return opts;
};

/**
 * Strip `**emphasis**` markers, returning the clean spoken text plus the spans
 * the emphasised words occupy in that clean text. Offsets are relative to the
 * narration; the caller shifts them into voiceover-wide coordinates.
 */
export const extractEmphasis = (
  markdown: string,
): { text: string; emphasis: CharSpan[] } => {
  const emphasis: CharSpan[] = [];
  let text = "";
  let i = 0;
  while (i < markdown.length) {
    if (markdown.startsWith("**", i)) {
      const close = markdown.indexOf("**", i + 2);
      if (close !== -1) {
        const inner = markdown.slice(i + 2, close);
        emphasis.push({ start: text.length, end: text.length + inner.length });
        text += inner;
        i = close + 2;
        continue;
      }
    }
    text += markdown[i];
    i += 1;
  }
  return { text, emphasis };
};

/** Collapse newlines and runs of whitespace — TTS wants one clean paragraph. */
const normaliseNarration = (s: string): string =>
  s.replace(/\s+/g, " ").trim();

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "scene";

export const parseScript = (source: string): Result<Script, Issue[]> => {
  const issues: Issue[] = [];

  const fmMatch = FRONTMATTER.exec(source);
  if (!fmMatch) {
    return err([
      issue("script.no-frontmatter", "Script must begin with a --- frontmatter block.", {
        hint: "Add:\n---\ntitle: My video\nvoice: elevenlabs:Rachel\nstyle: paper-vector\nformat: 9x16\n---",
      }),
    ]);
  }

  const fm = parseFrontmatter(fmMatch[1] ?? "");
  const body = source.slice(fmMatch[0].length);

  const formatName = (fm["format"] ?? "9x16") as FormatName;
  if (!(formatName in FORMATS)) {
    issues.push(
      issue("meta.bad-format", `Unknown format "${formatName}".`, {
        path: "meta.format",
        hint: `Use one of: ${Object.keys(FORMATS).join(", ")}`,
      }),
    );
  }

  const meta: ScriptMeta = {
    title: fm["title"] ?? "Untitled",
    voice: fm["voice"] ?? "elevenlabs:default",
    style: fm["style"] ?? "paper-vector",
    format: formatName in FORMATS ? formatName : "9x16",
    music: fm["music"],
    musicGainDb: fm["musicGainDb"] ? Number(fm["musicGainDb"]) : undefined,
    captions: (fm["captions"] as CaptionTheme) ?? "selection",
  };

  // Split on `## ` headings. Anything before the first heading is ignored.
  const chunks = body.split(/^##[ \t]+/m).slice(1);
  if (chunks.length === 0) {
    issues.push(
      issue("script.no-scenes", "Script contains no scenes.", {
        hint: 'Add a scene: "## 01 - intro" followed by a :: layout line and narration.',
      }),
    );
    return err(issues);
  }

  const scenes: ScriptScene[] = [];
  const seenIds = new Set<string>();
  let voiceoverText = "";

  chunks.forEach((chunk, index) => {
    const lines = chunk.split(/\r?\n/);
    const label = (lines[0] ?? "").trim();
    const rest = lines.slice(1);

    let layout = "stage";
    let propsRaw = "";
    const optionLines: string[] = [];
    const narrationLines: string[] = [];

    for (const line of rest) {
      const t = line.trim();
      if (t.startsWith("::")) {
        const directive = t.slice(2).trim();
        const brace = directive.indexOf("{");
        if (brace === -1) {
          layout = directive.trim();
        } else {
          layout = directive.slice(0, brace).trim();
          propsRaw = directive.slice(brace);
        }
      } else if (t.startsWith(">")) {
        optionLines.push(t.slice(1).trim());
      } else {
        narrationLines.push(line);
      }
    }

    const baseId = slugify(label) || `scene-${index + 1}`;
    let id = baseId;
    let dedupe = 2;
    while (seenIds.has(id)) id = `${baseId}-${dedupe++}`;
    seenIds.add(id);

    const propsResult = parseProps(propsRaw, id);
    if (!propsResult.ok) {
      issues.push(propsResult.error);
    }

    const { text: cleanNarration, emphasis: localEmphasis } = extractEmphasis(
      narrationLines.join("\n"),
    );
    const narration = normaliseNarration(cleanNarration);

    if (narration === "") {
      issues.push(
        issue("scene.no-narration", `Scene "${id}" has no narration.`, {
          scene: id,
          severity: "warning",
          hint: "A scene with no narration gets no duration. Add a line of script, or set > hold: 1500.",
        }),
      );
    }

    // Place this scene's narration in the global voiceover string.
    // A space separates scenes so the TTS does not run words together.
    const prefix = voiceoverText === "" ? "" : " ";
    const start = voiceoverText.length + prefix.length;
    voiceoverText += prefix + narration;
    const span: CharSpan = { start, end: start + narration.length };

    // Emphasis offsets were measured against the un-normalised narration, so
    // re-find each emphasised phrase in the normalised text to stay accurate.
    const emphasis: CharSpan[] = [];
    let searchFrom = 0;
    for (const e of localEmphasis) {
      const phrase = normaliseNarration(cleanNarration.slice(e.start, e.end));
      if (phrase === "") continue;
      const at = narration.indexOf(phrase, searchFrom);
      if (at === -1) continue;
      emphasis.push({ start: start + at, end: start + at + phrase.length });
      searchFrom = at + phrase.length;
    }

    scenes.push({
      id,
      label,
      layout,
      props: propsResult.ok ? propsResult.value : {},
      narration,
      span,
      emphasis,
      options: parseSceneOptions(optionLines),
    });
  });

  const blocking = issues.filter((i) => i.severity === "error");
  if (blocking.length > 0) return err(issues);

  return ok({ meta, scenes, voiceoverText });
};
