/**
 * The commands. This is the imperative shell: everything that touches the
 * network, the filesystem or ffmpeg lives here, and it delegates all decisions
 * to the pure core.
 */

import { execFile } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { promisify } from "node:util";
import { compile, toSrt } from "../core/compile.ts";
import { FORMATS } from "../core/types.ts";
import { parseScript } from "../core/script.ts";
import { validate, type ValidationReport } from "../core/validate.ts";
import type { VideoSpec, Word } from "../core/types.ts";
import { layoutNames, parseLayoutProps } from "../scenes/registry.ts";
import { narrate, type WhisperModel } from "../voice/index.ts";
import { fetchMedia, probeUrl, ytDlpAvailable } from "../media/fetch.ts";
import { extractAudio, prepareFootage } from "../media/footage.ts";
import { emitHyperframes } from "../renderers/hyperframes/emit.ts";
import { getStyle } from "../kit/styles/index.ts";
import { mix } from "../audio/mix.ts";
import { planSfx } from "../audio/sfx.ts";
import { log, fail } from "./log.ts";
import { ASSETS, BUNDLES, CACHE, DOWNLOADS, ENTRY, PROJECTS, ROOT, projectPaths, type ProjectPaths } from "./paths.ts";
import { SCRIPT_TEMPLATE } from "./template.ts";

const run = promisify(execFile);

// ------------------------------------------------------------------ helpers

const loadSpec = async (p: ProjectPaths): Promise<VideoSpec> => {
  if (!existsSync(p.spec)) {
    fail(`No video.json for "${p.name}". Run: pnpm video build ${p.name}`);
  }
  return JSON.parse(await readFile(p.spec, "utf8")) as VideoSpec;
};

const listAssets = async (dir: string): Promise<string[]> => {
  const out: string[] = [];
  const walk = async (current: string, prefix: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(join(current, e.name), rel);
      else out.push(rel);
    }
  };
  await walk(dir, "");
  return out;
};

/**
 * Chrome discovery.
 *
 * Remotion ships its own chrome-headless-shell, which is the right default.
 * Some environments (restricted shells, locked-down CI) will not let that
 * binary start, while a full Chrome already on the machine runs fine — so fall
 * back to one rather than failing the render.
 */
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const browserFlags = (): string[] => {
  const override = process.env["VIDEO_BROWSER_EXECUTABLE"];
  if (override) return ["--browser-executable", override];
  const found = CHROME_CANDIDATES.find((c) => existsSync(c));
  return found ? ["--browser-executable", found] : [];
};

/**
 * Bundle the composition once and reuse the result.
 *
 * Rendering twenty proof stills by shelling out to `remotion still` twenty
 * times re-runs webpack twenty times, which dominates the wall clock. Bundling
 * once to a serve directory turns a multi-minute proof pass into seconds, and
 * the stills are the step that gets run over and over while iterating.
 *
 * The bundle embeds the project's public directory, so it is per-project and
 * is rebuilt when the project's assets or the source change.
 */
const bundleProject = async (p: ProjectPaths): Promise<string> => {
  const outDir = join(BUNDLES, p.name);
  log.step("Bundling composition…");
  await run(
    "npx",
    [
      "remotion", "bundle", ENTRY,
      "--out-dir", outDir,
      "--public-dir", p.publicDir,
      "--log", "error",
    ],
    { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 },
  );
  return outDir;
};

// --------------------------------------------------------------------- new

export const cmdNew = async (name: string): Promise<void> => {
  if (!name) fail("Usage: pnpm video new <project-name>");
  const p = projectPaths(name);
  if (existsSync(p.dir)) fail(`Project "${name}" already exists at ${p.dir}`);

  await mkdir(p.dir, { recursive: true });
  await mkdir(p.publicDir, { recursive: true });
  await mkdir(p.scenesDir, { recursive: true });
  await writeFile(p.script, SCRIPT_TEMPLATE(name));
  await writeFile(
    join(p.scenesDir, "index.ts"),
    `/**
 * Custom scenes for this project.
 *
 * Register a component here, then reference it from script.md:
 *   :: custom { component: "MyScene", props: { ... } }
 */
// import { registerComponent } from "../../../src/scenes/registry.ts";
// import { MyScene } from "./MyScene.tsx";
// registerComponent("MyScene", MyScene);

export {};
`,
  );

  log.done(`Created projects/${name}/`);
  log.dim(`  script.md    the script — edit this`);
  log.dim(`  public/      images and music referenced by scenes`);
  log.dim(`  scenes/      custom React scenes, when a layout will not do`);
  log.plain("");
  log.step(`Next: pnpm video all ${name} --mock-voice`);
};

// ------------------------------------------------------------------- voice

export type VoiceOptions = {
  readonly mock: boolean;
  /** Time the script against an existing recording instead of synthesising. */
  readonly audioPath?: string;
  readonly whisperModel?: WhisperModel;
};

export const cmdVoice = async (name: string, options: VoiceOptions): Promise<void> => {
  const { mock, audioPath, whisperModel } = options;
  const p = projectPaths(name);
  if (!existsSync(p.script)) fail(`No script at ${p.script}`);

  const parsed = parseScript(await readFile(p.script, "utf8"));
  if (!parsed.ok) {
    for (const i of parsed.error) log.fail(`${i.code}: ${i.message}`);
    process.exit(1);
  }

  const script = parsed.value;
  const wordCount = script.voiceoverText.split(/\s+/).length;
  log.step(
    audioPath
      ? `Timing ${wordCount} words against ${basename(audioPath)} with Whisper…`
      : `Narrating ${wordCount} words${mock ? " (mock)" : ""}…`,
  );

  const result = await narrate({
    text: script.voiceoverText,
    voice: script.meta.voice,
    cacheDir: CACHE,
    mock,
    audioPath,
    whisperModel,
    projectRoot: ROOT,
  });

  // Remotion serves audio from the project's public/ directory.
  await mkdir(p.publicDir, { recursive: true });
  const dest = join(p.publicDir, "voiceover.mp3");

  if (audioPath) {
    // An arbitrary recording may be any container; normalise it to mp3 so the
    // rest of the pipeline sees the same thing whatever was handed in.
    await extractAudio(result.audioPath, dest);
  } else {
    await cp(result.audioPath, dest);
  }

  await writeFile(join(p.publicDir, "words.json"), JSON.stringify(result.words));

  const last = result.words[result.words.length - 1];
  const seconds = (last?.endMs ?? 0) / 1000;
  log.done(
    `Voiceover ${seconds.toFixed(1)}s via ${result.source}${result.cached ? " (cached)" : ""}`,
  );

  if (result.coverage !== undefined) {
    const pct = Math.round(result.coverage * 100);
    const line = `${pct}% of script words matched the transcript`;
    if (result.coverage < 0.75) {
      log.warn(`${line} — timings for the rest are interpolated.`);
      log.dim("    Check the recording matches the script, or try --whisper-model small.");
    } else {
      log.dim(`  ${line}`);
    }
  }
};

// ------------------------------------------------------------------- build

export const cmdBuild = async (name: string): Promise<void> => {
  const p = projectPaths(name);
  if (!existsSync(p.script)) fail(`No script at ${p.script}`);

  const wordsPath = join(p.publicDir, "words.json");
  if (!existsSync(wordsPath)) {
    fail(`No voiceover yet. Run: pnpm video voice ${name} [--mock-voice]`);
  }

  const parsed = parseScript(await readFile(p.script, "utf8"));
  if (!parsed.ok) {
    for (const i of parsed.error) log.fail(`${i.code}: ${i.message}`);
    process.exit(1);
  }

  const words = JSON.parse(await readFile(wordsPath, "utf8")) as Word[];
  const built = compile(parsed.value, words, { voiceoverPath: "voiceover.mp3" });
  if (!built.ok) {
    for (const i of built.error) log.fail(`${i.code}: ${i.message}`);
    process.exit(1);
  }

  // Resolve every scene's props through its layout schema before writing the
  // spec. zod applies the schema defaults here, once, so the renderer receives
  // complete props. Without this step a layout's `.default()` never actually
  // runs — the renderer gets whatever the script happened to write, and a
  // missing optional silently becomes `undefined` at the point of use.
  const resolved = built.value.scenes.map((scene) => {
    const parsedProps = parseLayoutProps(scene.layout, scene.props as Record<string, unknown>);
    if (!parsedProps.ok) {
      for (const e of parsedProps.errors) {
        log.fail(`${scene.id} (${scene.layout}) props.${e.path}: ${e.message}`);
      }
      process.exit(1);
    }
    return { ...scene, props: parsedProps.value };
  });

  const spec: VideoSpec = { ...built.value, scenes: resolved };

  // Pre-mix narration, the ducked music bed and any derived sound effects into
  // one track, so the composition plays a single finished file.
  const music = spec.audio.music ? join(ASSETS, spec.audio.music) : undefined;
  const cues = planSfx(spec, join(ASSETS, "sfx"));
  const mixed = join(p.publicDir, "mixed.mp3");

  await mix({
    voiceoverPath: join(p.publicDir, "voiceover.mp3"),
    musicPath: music && existsSync(music) ? music : undefined,
    outPath: mixed,
    musicGainDb: spec.audio.musicGainDb,
    sfx: cues,
  });

  const finalSpec: VideoSpec = {
    ...spec,
    audio: { ...spec.audio, voiceover: "mixed.mp3", music: undefined },
  };

  await writeFile(p.spec, `${JSON.stringify(finalSpec, null, 2)}\n`);

  await mkdir(p.out, { recursive: true });
  await writeFile(join(p.out, `${name}.srt`), toSrt(spec.captions));
  if (cues.length > 0) log.dim(`  ${cues.length} sound cue(s) mixed in`);
  if (music && existsSync(music)) log.dim(`  music ducked under narration`);

  const seconds = spec.durationInFrames / spec.format.fps;
  log.done(
    `Built video.json — ${spec.scenes.length} scenes, ${seconds.toFixed(1)}s, ${spec.format.width}x${spec.format.height}`,
  );
};

// ---------------------------------------------------------------- validate

export const runValidation = async (p: ProjectPaths): Promise<ValidationReport> => {
  const spec = await loadSpec(p);
  const assets = [
    ...(await listAssets(p.publicDir)),
    ...(await listAssets(ASSETS)).map((a) => a),
  ];

  return validate(spec, {
    knownLayouts: layoutNames(),
    checkProps: (layout, props) => {
      const r = parseLayoutProps(layout, props);
      return r.ok ? { ok: true } : { ok: false, errors: r.errors };
    },
    existingAssets: assets,
  });
};

export const cmdValidate = async (name: string, json: boolean): Promise<void> => {
  const p = projectPaths(name);
  const report = await runValidation(p);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }

  if (report.issues.length === 0) {
    log.done("No issues.");
    return;
  }

  for (const i of report.issues) {
    const line = `${i.severity === "error" ? "✗" : "!"} ${i.code}${
      i.scene ? ` [${i.scene}]` : ""
    }: ${i.message}`;
    if (i.severity === "error") log.fail(line);
    else log.warn(line);
    if (i.hint) log.dim(`    ${i.hint}`);
  }

  log.plain("");
  log.plain(`${report.errors} error(s), ${report.warnings} warning(s)`);
  if (!report.ok) process.exit(1);
};

// ------------------------------------------------------------------- proof

/**
 * Render one still per scene.
 *
 * This is the feedback loop that makes the project usable by an agent: Claude
 * can open these PNGs and judge the result, rather than writing a script blind
 * and hoping. Stills are cheap; a full render is not.
 */
export const cmdProof = async (name: string): Promise<void> => {
  const p = projectPaths(name);
  const spec = await loadSpec(p);

  await rm(p.proof, { recursive: true, force: true });
  await mkdir(p.proof, { recursive: true });

  const serveUrl = await bundleProject(p);
  const propsFile = join(p.out, ".props.json");
  await writeFile(propsFile, JSON.stringify({ spec }));

  log.step(`Rendering ${spec.scenes.length} proof stills…`);

  for (const [i, scene] of spec.scenes.entries()) {
    // A third of the way in: entrances have settled, exits have not begun.
    const frame = scene.startFrame + Math.floor(scene.durationInFrames / 3);
    const out = join(p.proof, `${String(i + 1).padStart(2, "0")}-${scene.id}.png`);

    await run(
      "npx",
      [
        "remotion", "still", serveUrl, "Video", out,
        "--frame", String(frame),
        "--props", propsFile,
        ...browserFlags(),
        "--log", "error",
      ],
      { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 },
    );
    log.dim(`  ${String(i + 1).padStart(2, "0")} ${scene.label}`);
  }

  await rm(propsFile, { force: true });
  log.done(`Proof sheet: ${relative(process.cwd(), p.proof)}/`);
};

// ------------------------------------------------------------------ render

export type Renderer = "remotion" | "hyperframes";

/** Pinned: HyperFrames publishes very frequently, and renders should be reproducible. */
const HYPERFRAMES_VERSION = "0.8.214";

/**
 * Emit a HyperFrames composition and render it.
 *
 * Both backends consume the same video.json. HyperFrames renders plain HTML
 * with a GSAP timeline rather than React, which is what gives it native
 * <video> clips and a Lambda render path — and a way through when Remotion's
 * bundled Chrome will not start.
 */
const renderWithHyperframes = async (
  p: ProjectPaths,
  spec: VideoSpec,
  out: string,
): Promise<void> => {
  const htmlDir = join(p.out, "hyperframes");
  await mkdir(htmlDir, { recursive: true });

  const html = emitHyperframes(spec, getStyle(spec.meta.style));
  await writeFile(join(htmlDir, "index.html"), html);

  // HyperFrames resolves media relative to the composition, so the audio and
  // any footage have to sit beside index.html.
  for (const asset of await listAssets(p.publicDir)) {
    const from = join(p.publicDir, asset);
    const to = join(htmlDir, asset);
    await mkdir(dirname(to), { recursive: true });
    await cp(from, to);
  }

  // `render <DIR>` expects a project directory holding index.html.
  log.step("Rendering with HyperFrames…");
  await run(
    "npx",
    ["-y", `hyperframes@${HYPERFRAMES_VERSION}`, "render", htmlDir, "-o", out, "--quality", "looks"],
    { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 },
  );
};

export const cmdRender = async (
  name: string,
  extra: string[],
  renderer: Renderer = "remotion",
): Promise<void> => {
  const p = projectPaths(name);
  const spec = await loadSpec(p);

  const report = await runValidation(p);
  if (!report.ok) {
    for (const i of report.issues.filter((x) => x.severity === "error")) {
      log.fail(`${i.code}: ${i.message}`);
    }
    fail("Validation failed. Fix the errors above, or run `video validate` for detail.");
  }

  await mkdir(p.out, { recursive: true });
  const out = join(p.out, `${name}.mp4`);
  const seconds = spec.durationInFrames / spec.format.fps;

  if (renderer === "hyperframes") {
    await renderWithHyperframes(p, spec, out);
    log.done(`${relative(process.cwd(), out)}`);
    return;
  }

  const serveUrl = await bundleProject(p);
  const propsFile = join(p.out, ".props.json");
  await writeFile(propsFile, JSON.stringify({ spec }));

  log.step(`Rendering ${seconds.toFixed(1)}s at ${spec.format.width}x${spec.format.height}…`);

  await run(
    "npx",
    [
      "remotion", "render", serveUrl, "Video", out,
      "--props", propsFile,
      ...browserFlags(),
      "--log", "info",
      ...extra,
    ],
    { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 },
  );

  await rm(propsFile, { force: true });

  log.done(`${relative(process.cwd(), out)}`);
  log.dim(`  captions: ${relative(process.cwd(), join(p.out, `${name}.srt`))}`);
};

// ----------------------------------------------------------------- preview

export const cmdPreview = async (name: string): Promise<void> => {
  const p = projectPaths(name);
  const spec = await loadSpec(p);
  log.step(`Opening studio for "${name}"…`);
  await run("npx", ["remotion", "studio", ENTRY, "--props", JSON.stringify({ spec })], {
    cwd: p.dir,
    env: { ...process.env, REMOTION_PUBLIC_DIR: p.publicDir },
  }).catch(() => undefined);
};

// --------------------------------------------------------------------- all

export const cmdAll = async (name: string, voice: VoiceOptions, renderer: Renderer): Promise<void> => {
  await cmdVoice(name, voice);
  await cmdBuild(name);
  const report = await runValidation(projectPaths(name));
  if (report.warnings > 0) {
    log.warn(`${report.warnings} warning(s) — run \`pnpm video validate ${name}\` for detail.`);
  }
  if (!report.ok) {
    await cmdValidate(name, false);
    return;
  }
  await cmdRender(name, [], renderer);
};

// ------------------------------------------------------------------ fetch

/**
 * Pull media with yt-dlp and prepare it for use in a scene.
 *
 * `--audio` grabs only the soundtrack, which is how you time a script against
 * an existing video: fetch its audio, then `voice <name> --audio <file>`.
 * Otherwise the clip is normalised to the project's frame size and dropped
 * into public/footage/ ready for a `footage` scene.
 */
export const cmdFetch = async (
  name: string,
  url: string,
  options: { audioOnly?: boolean; section?: string; fit?: "cover" | "contain" | "blur" },
): Promise<void> => {
  if (!url) fail("Usage: pnpm video fetch <project> <url> [--audio] [--section '*00:10-00:25']");

  const p = projectPaths(name);
  if (!existsSync(p.dir)) fail(`No project "${name}".`);
  if (!ytDlpAvailable(ROOT)) {
    fail(
      "yt-dlp is not installed. Run:\n" +
        "  uv venv .venv-media --python 3.12\n" +
        "  uv pip install --python .venv-media faster-whisper yt-dlp",
    );
  }

  log.step("Reading source…");
  const info = await probeUrl(url, ROOT);
  log.dim(`  ${info.title}${info.durationSec ? ` · ${Math.round(info.durationSec)}s` : ""}`);

  const fetched = await fetchMedia({
    url,
    destDir: join(DOWNLOADS, name),
    projectRoot: ROOT,
    kind: options.audioOnly ? "audio" : "video",
    section: options.section,
  });
  log.dim(`  ${fetched.cached ? "cached" : "downloaded"} ${Math.round(fetched.durationSec)}s`);

  if (options.audioOnly) {
    const dest = join(p.publicDir, "source-audio.mp3");
    await mkdir(p.publicDir, { recursive: true });
    await extractAudio(fetched.path, dest);
    log.done(`${relative(process.cwd(), dest)}`);
    log.dim(`  Time a script to it: pnpm video voice ${name} --audio ${relative(process.cwd(), dest)}`);
    return;
  }

  // Normalise to the project's frame so a scene can use it with no further work.
  const parsed = parseScript(await readFile(p.script, "utf8"));
  const format = parsed.ok ? FORMATS[parsed.value.meta.format] : FORMATS["9x16"];

  const slug = fetched.title.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 40);
  const rel = join("footage", `${slug}.mp4`);
  const dest = join(p.publicDir, rel);

  log.step(`Normalising to ${format.width}x${format.height}…`);
  await prepareFootage({
    inputPath: fetched.path,
    outPath: dest,
    format,
    fit: options.fit ?? "cover",
  });

  log.done(`${relative(process.cwd(), dest)}`);
  log.dim(`  Use it:  :: footage { src: "${rel}" }`);
};

// ------------------------------------------------------------------ list

export const cmdList = async (): Promise<void> => {
  const entries = await readdir(PROJECTS, { withFileTypes: true }).catch(() => []);
  const projects = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  if (projects.length === 0) {
    log.dim("No projects yet. Create one: pnpm video new my-video");
    return;
  }
  log.title("Projects");
  for (const name of projects) {
    const p = projectPaths(name);
    const built = existsSync(p.spec) ? "built" : "not built";
    log.plain(`  ${name}  ${built}`);
  }
};

// --------------------------------------------------------------- catalog

export const cmdCatalog = async (json: boolean): Promise<void> => {
  const { LAYOUTS } = await import("../scenes/registry.ts");
  if (json) {
    console.log(
      JSON.stringify(
        LAYOUTS.map((l) => ({
          name: l.name,
          summary: l.summary,
          useWhen: l.useWhen,
          example: l.example,
        })),
        null,
        2,
      ),
    );
    return;
  }
  log.title("Layouts");
  for (const l of LAYOUTS) {
    log.plain(`\n  ${l.name}  —  ${l.summary}`);
    log.dim(`    ${l.useWhen}`);
    log.dim(`    ${l.example}`);
  }
};
