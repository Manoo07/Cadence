/**
 * Style + scene context.
 *
 * Scenes read tokens and their own timing from context rather than props, so a
 * layout signature stays about content ("what are the steps?") and never about
 * plumbing ("what frame is it, what colour is ink?").
 */

import React, { createContext, useContext, useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Format } from "../core/types.ts";
import { getStyle } from "./styles/index.ts";
import type { StylePack } from "./tokens.ts";

export type SceneContextValue = {
  readonly style: StylePack;
  readonly format: Format;
  /** Frame relative to the start of this scene. */
  readonly frame: number;
  readonly durationInFrames: number;
  readonly fps: number;
  /** Frames, relative to scene start, when emphasised words are spoken. */
  readonly beats: readonly number[];
  /**
   * Multiplier from the 1080x1920 reference grid to the current format, so a
   * layout authored once reads correctly at 16:9 and 1:1.
   */
  readonly scale: number;
};

const SceneContext = createContext<SceneContextValue | null>(null);

export const useScene = (): SceneContextValue => {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error("useScene must be called inside <SceneProvider>.");
  return ctx;
};

/** Tokens alone, for components that do not care about timing. */
export const useStyle = (): StylePack => useScene().style;

const REFERENCE_WIDTH = 1080;

export const SceneProvider: React.FC<{
  styleName: string;
  format: Format;
  durationInFrames: number;
  beats: readonly number[];
  children: React.ReactNode;
}> = ({ styleName, format, durationInFrames, beats, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const value = useMemo<SceneContextValue>(
    () => ({
      style: getStyle(styleName),
      format,
      frame,
      durationInFrames,
      fps,
      beats,
      scale: format.width / REFERENCE_WIDTH,
    }),
    [styleName, format, frame, durationInFrames, fps, beats],
  );

  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>;
};

/** Convenience: scene-aware sizing in reference-grid px. */
export const useScaled = (): ((px: number) => number) => {
  const { scale } = useScene();
  return (px: number) => px * scale;
};
