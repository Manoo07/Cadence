/**
 * Captions.
 *
 * Burned in rather than left as a sidecar, because on vertical social video
 * captions are a design element and most viewers watch muted. An .srt is
 * emitted alongside for platforms that want one.
 *
 * Word timings come from the same source that drove the scene cuts — an
 * ElevenLabs character alignment or a Whisper transcript transferred onto the
 * script — so highlighting is exact by construction rather than tuned by hand.
 *
 * Paging is delegated to `core/captions.ts` so this and the HyperFrames
 * backend break lines identically.
 */

import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { groupIntoPages, pageAt } from "../core/captions.ts";
import type { CaptionTheme, Format, Word } from "../core/types.ts";
import type { StylePack } from "../kit/tokens.ts";
import { BlockCaption, KaraokeCaption, SelectionCaption } from "./themes/index.tsx";

export type CaptionsProps = {
  words: readonly Word[];
  theme: CaptionTheme;
  style: StylePack;
  format: Format;
  frame: number;
  fps: number;
};

export const Captions: React.FC<CaptionsProps> = ({
  words,
  theme,
  style,
  format,
  frame,
  fps,
}) => {
  const pages = useMemo(() => groupIntoPages(words), [words]);
  if (theme === "none" || pages.length === 0) return null;

  const nowMs = (frame / fps) * 1000;
  const page = pageAt(pages, nowMs);
  if (!page) return null;

  const scale = format.width / 1080;
  const Theme =
    theme === "karaoke" ? KaraokeCaption
    : theme === "block" ? BlockCaption
    : SelectionCaption;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: format.safe.bottom * 0.42,
        paddingLeft: format.safe.left,
        paddingRight: format.safe.right,
        pointerEvents: "none",
      }}
    >
      <Theme page={page} nowMs={nowMs} style={style} scale={scale} />
    </AbsoluteFill>
  );
};
