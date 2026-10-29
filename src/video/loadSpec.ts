/**
 * Spec loading for the renderer.
 *
 * Remotion bundles the entry point, so the spec cannot simply be read from
 * disk at render time inside the browser bundle. It is instead injected as an
 * environment variable by the CLI (Remotion forwards REMOTION_ prefixed vars
 * into the bundle), with a filesystem read as the fallback for `remotion
 * studio` started by hand.
 */

import type { VideoSpec } from "../core/types.ts";

export const loadProjectSpec = (): VideoSpec | null => {
  const inline = process.env["REMOTION_VIDEO_SPEC"];
  if (inline) {
    try {
      return JSON.parse(inline) as VideoSpec;
    } catch {
      return null;
    }
  }
  return null;
};
