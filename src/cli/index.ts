#!/usr/bin/env tsx
/**
 * Cadence — a script goes in, a narrated, captioned, animated MP4 comes out.
 *
 * Named for the rhythm of speech, because that is what sets the rhythm of the
 * video: the voice arrives first and every frame number is measured from it.
 *
 *   new <name>        scaffold a project
 *   voice <name>      synthesise narration and capture word timings
 *   build <name>      script.md + timings -> video.json
 *   validate <name>   structured report of everything wrong
 *   proof <name>      one still per scene, to look at before rendering
 *   preview <name>    open Remotion studio
 *   render <name>     produce the MP4
 *   all <name>        voice -> build -> validate -> render
 *   catalog           list the layouts available to a script
 *   list              list projects
 *
 * Flags: --mock-voice (no API key, no spend) · --json (machine-readable)
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cmdAll,
  cmdBuild,
  cmdCatalog,
  cmdList,
  cmdNew,
  cmdPreview,
  cmdProof,
  cmdRender,
  cmdFetch,
  cmdValidate,
  cmdVoice,
  type Renderer,
} from "./commands.ts";
import { log } from "./log.ts";
import { ROOT } from "./paths.ts";

/** Minimal .env loader — one less dependency for one line of work. */
const loadEnv = (): void => {
  const path = join(ROOT, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (t === "" || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const value = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
};

const USAGE = `
Cadence — script in, video out

  pnpm cadence new <name>             scaffold a project
  pnpm cadence voice <name>           narration + word timings
  pnpm cadence fetch <name> <url>     pull footage or audio with yt-dlp
  pnpm cadence build <name>           compile script.md -> video.json
  pnpm cadence validate <name>        report problems (add --json for an agent)
  pnpm cadence proof <name>           render one still per scene
  pnpm cadence preview <name>         open Remotion studio
  pnpm cadence render <name>          render the MP4
  pnpm cadence all <name>             voice -> build -> validate -> render
  pnpm cadence catalog                list available layouts
  pnpm cadence list                   list projects

Flags
  --mock-voice             offline narration; no API key, no spend
  --audio <file>           time the script to an existing recording (Whisper)
  --whisper-model <size>   tiny | base | small | medium | large-v3  (default base)
  --renderer <name>        remotion (default) | hyperframes
  --audio-only             fetch: take the soundtrack only
  --section <range>        fetch: trim, e.g. '*00:01:10-00:01:25'
  --fit <mode>             fetch: cover (default) | contain | blur
  --json                   machine-readable output (validate, catalog)
`;

const main = async (): Promise<void> => {
  loadEnv();

  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const positional = argv.filter((a) => !a.startsWith("--"));
  const [command, name] = positional;

  /** Value flags: --key value, or --key=value. */
  const valueOf = (key: string): string | undefined => {
    const eq = argv.find((a) => a.startsWith(`--${key}=`));
    if (eq) return eq.slice(key.length + 3);
    const at = argv.indexOf(`--${key}`);
    if (at !== -1) {
      const next = argv[at + 1];
      if (next && !next.startsWith("--")) return next;
    }
    return undefined;
  };

  const mock = flags.has("--mock-voice") || flags.has("--mock");
  const json = flags.has("--json");

  const voiceOptions = {
    mock,
    audioPath: valueOf("audio"),
    whisperModel: valueOf("whisper-model") as
      | "tiny" | "base" | "small" | "medium" | "large-v3" | undefined,
  };

  const renderer = (valueOf("renderer") ?? "remotion") as Renderer;
  if (renderer !== "remotion" && renderer !== "hyperframes") {
    log.fail(`Unknown renderer "${renderer}". Use remotion or hyperframes.`);
    process.exit(1);
  }

  // Everything we do not consume ourselves is forwarded to the renderer.
  const OWN_FLAGS = new Set([
    "--mock-voice", "--mock", "--json", "--audio", "--whisper-model",
    "--renderer", "--audio-only", "--section", "--fit",
  ]);
  const consumedValues = new Set(
    ["audio", "whisper-model", "renderer", "section", "fit"]
      .map((k) => valueOf(k))
      .filter((v): v is string => v !== undefined),
  );
  const passthrough = argv.filter(
    (a) =>
      a.startsWith("--") &&
      !OWN_FLAGS.has(a) &&
      !OWN_FLAGS.has(a.split("=")[0] ?? "") &&
      !consumedValues.has(a),
  );

  const needsName = (): string => {
    if (!name) {
      log.fail(`"${command}" needs a project name.`);
      process.exit(1);
    }
    return name;
  };

  switch (command) {
    case "new":
      return cmdNew(name ?? "");
    case "voice":
      return cmdVoice(needsName(), voiceOptions);
    case "build":
      return cmdBuild(needsName());
    case "validate":
      return cmdValidate(needsName(), json);
    case "proof":
      return cmdProof(needsName());
    case "preview":
      return cmdPreview(needsName());
    case "render":
      return cmdRender(needsName(), passthrough, renderer);
    case "fetch":
      return cmdFetch(needsName(), positional[2] ?? "", {
        audioOnly: flags.has("--audio-only"),
        section: valueOf("section"),
        fit: valueOf("fit") as "cover" | "contain" | "blur" | undefined,
      });
    case "all":
      return cmdAll(needsName(), voiceOptions, renderer);
    case "catalog":
      return cmdCatalog(json);
    case "list":
      return cmdList();
    default:
      console.log(USAGE);
      process.exit(command ? 1 : 0);
  }
};

main().catch((e: unknown) => {
  log.fail(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
