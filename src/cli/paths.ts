/**
 * Project layout on disk.
 *
 * Remotion serves `staticFile()` from a `public/` directory, so generated
 * audio lands there rather than in `out/`. Everything else a project owns —
 * script, spec, custom scenes, renders — sits beside it.
 */

import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export const ROOT = resolve(here, "..", "..");
export const PROJECTS = join(ROOT, "projects");
export const ASSETS = join(ROOT, "assets");
export const CACHE = join(ROOT, ".cache", "voice");
export const BUNDLES = join(ROOT, ".cache", "bundles");
/** Downloaded media. Untrusted: each fetch gets its own subdirectory. */
export const DOWNLOADS = join(ROOT, ".cache", "downloads");
export const ENTRY = join(ROOT, "src", "video", "index.ts");

export type ProjectPaths = {
  readonly name: string;
  readonly dir: string;
  readonly script: string;
  readonly spec: string;
  readonly publicDir: string;
  readonly scenesDir: string;
  readonly out: string;
  readonly proof: string;
};

export const projectPaths = (name: string): ProjectPaths => {
  const dir = join(PROJECTS, name);
  return {
    name,
    dir,
    script: join(dir, "script.md"),
    spec: join(dir, "video.json"),
    publicDir: join(dir, "public"),
    scenesDir: join(dir, "scenes"),
    out: join(dir, "out"),
    proof: join(dir, "out", "proof"),
  };
};
