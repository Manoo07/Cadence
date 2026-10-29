/**
 * footage — a video clip as the scene.
 *
 * The one layout that is not drawn. B-roll pulled with `video fetch` and
 * normalised to the frame lands here. A clip earns its place when it shows
 * something a diagram cannot — a real interface, a real place, a real
 * reaction. It is not a substitute for having a point.
 *
 * The clip is deliberately muted by default and sits under an optional scrim,
 * because in this project the narration owns the audio and the captions have
 * to stay readable over whatever the footage happens to be doing.
 */

import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { z } from "zod";
import { Badge, Text, useScene } from "../kit/index.ts";
import { enter, ramp } from "../kit/motion.ts";
import { defineLayout } from "./types.ts";

/** #RRGGBB -> rgba(), so a token colour can be used inside a gradient stop. */
const hexToRgba = (hex: string, alpha: number): string => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const schema = z.object({
  src: z.string().describe("Clip path under the project's public/ directory."),
  headline: z.string().optional(),
  badge: z.string().optional(),
  caption: z.string().optional(),
  /** Seconds into the clip to begin. */
  startFrom: z.number().default(0),
  /** How much of the frame the clip fills. `full` bleeds to the edges. */
  frame: z.enum(["full", "inset"]).default("full"),
  /** Darkening over the top of the clip, so an overlaid headline stays legible. */
  scrim: z.number().min(0).max(1).default(0.22),
  /** Play the clip's own audio. Off by default — narration owns the track. */
  sound: z.boolean().default(false),
  /** Slow push on the clip, for a shot that is otherwise static. */
  drift: z.boolean().default(true),
});

const Footage: React.FC<z.infer<typeof schema>> = ({
  src,
  headline,
  badge,
  caption,
  startFrom = 0,
  frame: framing = "full",
  scrim = 0.22,
  sound = false,
  drift = true,
}) => {
  const { style, frame, fps, format, scale, durationInFrames } = useScene();
  const { palette, shape } = style;

  const inset = framing === "inset";
  const push = drift ? 1 + ramp(frame, 0, durationInFrames) * 0.05 : 1;

  // Start the fade just above the caption zone so it reads as the image
  // settling onto the page rather than as a band laid over it.
  const captionTop = format.height - format.safe.bottom;
  const captionFadeStart = ((captionTop - 120 * scale) / format.height) * 100;
  const captionFadeEnd = ((captionTop + 90 * scale) / format.height) * 100;

  const video = (
    <OffthreadVideo
      src={staticFile(src)}
      startFrom={Math.round(startFrom * fps)}
      muted={!sound}
      volume={sound ? 0.35 : 0}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: `scale(${push})`,
      }}
    />
  );

  return (
    <AbsoluteFill>
      {inset ? (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            padding: `${format.safe.top}px ${format.safe.left}px ${format.safe.bottom}px`,
          }}
        >
          <div
            style={{
              width: "100%",
              aspectRatio: "4 / 5",
              overflow: "hidden",
              border: `${shape.stroke * scale}px solid ${palette.ink}`,
              borderRadius: shape.radius.lg * scale,
              boxShadow: shape.shadow,
              ...enter(frame, fps, style.motion, { delay: 0 }),
            }}
          >
            {video}
          </div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ overflow: "hidden" }}>{video}</AbsoluteFill>
      )}

      {/*
        Two separate treatments, because the top and bottom of the frame have
        different jobs.

        The top gets a dark scrim so a white headline reads over whatever the
        footage is doing. The bottom fades to the page colour instead, so the
        captions sit on exactly the same ground they do in every other scene —
        one caption treatment for the whole video, and legibility that does not
        depend on how bright this particular clip happens to be.
      */}
      {scrim > 0 && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(to bottom, rgba(20,22,26,${scrim}) 0%, rgba(20,22,26,0) 34%)`,
            pointerEvents: "none",
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to bottom, ${hexToRgba(palette.bg, 0)} ${captionFadeStart}%, ${hexToRgba(palette.bg, 0.92)} ${captionFadeEnd}%, ${palette.bg} 100%)`,
          pointerEvents: "none",
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          padding: `${format.safe.top * 1.1}px ${format.safe.left}px`,
          gap: 16 * scale,
        }}
      >
        {badge && <Badge tone="accent">{badge}</Badge>}
        {headline && (
          <Text
            role="title"
            tone={framing === "full" ? "bg" : "ink"}
            align="center"
            animate={{ delay: 3 }}
            maxWidth={format.width * 0.86}
            style={
              framing === "full"
                ? { textShadow: `0 ${3 * scale}px ${12 * scale}px rgba(20,22,26,0.5)` }
                : undefined
            }
          >
            {headline}
          </Text>
        )}
        {caption && (
          <Text role="body" tone={framing === "full" ? "bg" : "soft"} align="center" animate={{ delay: 10 }}>
            {caption}
          </Text>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const footageLayout = defineLayout({
  name: "footage",
  summary: "A video clip filling the frame, with optional overlaid text.",
  useWhen:
    "You need to show something real that a drawing cannot carry. Fetch the clip with `video fetch <url>` first; it is muted by default so the narration still leads.",
  schema,
  component: Footage,
  example: `:: footage { src: "footage/demo.mp4", headline: "This is what it looks like", badge: "live" }`,
});
