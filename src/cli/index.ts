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
  cmdFinal,
  cmdQuota,
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

Draft — free, offline, run as often as you like
  pnpm cadence new <name>             scaffold a project
  pnpm cadence voice <name>           draft narration + word timings
  pnpm cadence build <name>           compile script.md -> video.json
  pnpm cadence validate <name>        report problems (--json for an agent)
  pnpm cadence proof <name>           one still per scene — look at these
  pnpm cadence preview <name>         open Remotion studio
  pnpm cadence render <name>          render the MP4
  pnpm cadence all <name>             the four above, in order

Finish — the only step that spends ElevenLabs characters
  pnpm cadence final <name>           validate, then buy the real voice, then render
  pnpm cadence quota                  how many characters you have left

Other
  pnpm cadence fetch <name> <url>     pull footage or audio with yt-dlp
  pnpm cadence catalog                list available layouts
  pnpm cadence list                   list projects

Flags
  --real                   voice: use ElevenLabs instead of the draft voice
  -y, --yes                skip the spend confirmation
  --audio <file>           time the script to an existing recording (Whisper)
  --whisper-model <size>   tiny | base | small | medium | large-v3  (default base)
  --renderer <name>        remotion (default) | hyperframes
  --audio-only             fetch: take the soundtrack only
  --section <range>        fetch: trim, e.g. '*00:01:10-00:01:25'
  --fit <mode>             fetch: cover (default) | contain | blur
  --json                   machine-readable output
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
    real: flags.has("--real"),
    yes: flags.has("--yes") || flags.has("-y"),
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
    "--renderer", "--audio-only", "--section", "--fit", "--real", "--yes", "-y",
  ]);
  const VALUE_FLAGS = ["audio", "whisper-model", "renderer", "section", "fit"];

  /**
   * Forward unrecognised flags to the renderer, values included.
   *
   * Filtering argv for strings starting with `--` loses the value of a
   * `--flag value` pair, so `--concurrency 2` reaches the renderer as a bare
   * `--concurrency` and fails there. Walk the list instead and carry the next
   * token when it is not itself a flag.
   */
  const passthrough: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const bare = arg.split("=")[0] ?? arg;
    if (OWN_FLAGS.has(arg) || OWN_FLAGS.has(bare)) {
      // Skip this flag, and its value when it takes a separate one.
      if (!arg.includes("=") && VALUE_FLAGS.includes(bare.slice(2))) i += 1;
      continue;
    }
    passthrough.push(arg);
    const next = argv[i + 1];
    if (!arg.includes("=") && next && !next.startsWith("-")) {
      passthrough.push(next);
      i += 1;
    }
  }

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
      // Discard the result: the switch arms all resolve to void.
      await cmdVoice(needsName(), voiceOptions);
      return;
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
    case "final":
    case "finalize":
    case "finalise":
      return cmdFinal(needsName(), {
        yes: voiceOptions.yes,
        renderer,
        whisperModel: voiceOptions.whisperModel,
      });
    case "quota":
      return cmdQuota(json);
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
