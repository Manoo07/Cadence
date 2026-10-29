/**
 * stage — a centred subject with a caption.
 *
 * The workhorse. When a scene is really about one object — a diagram, a
 * screenshot, a mascot, a single number — this frames it and gets out of the way.
 */

import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { z } from "zod";
import { Badge, Panel, Text, useScene } from "../kit/index.ts";
import { beatPulse, enter, idleDrift } from "../kit/motion.ts";
import { defineLayout } from "./types.ts";

const schema = z.object({
  headline: z.string().optional(),
  caption: z.string().optional(),
  badge: z.string().optional(),
  /** Path under assets/, e.g. "figures/robot.png". */
  image: z.string().optional(),
  /** Large emoji or glyph, when no artwork exists yet. */
  glyph: z.string().optional(),
  tone: z.enum(["plain", "panel"]).default("plain"),
});

const Stage: React.FC<z.infer<typeof schema>> = ({
  headline,
  caption,
  badge,
  image,
  glyph,
  tone = "plain",
}) => {
  const { style, frame, fps, beats, format, scale } = useScene();
  const pulse = beatPulse(frame, beats, { amount: 0.05 });
  const drift = idleDrift(frame, 1, 5 * scale);

  const subject = image ? (
    <Img
      src={staticFile(image)}
      style={{ maxWidth: format.width * 0.72, maxHeight: format.height * 0.4, objectFit: "contain" }}
    />
  ) : glyph ? (
    <div style={{ fontSize: 260 * scale, lineHeight: 1 }}>{glyph}</div>
  ) : null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: `${format.safe.top}px ${format.safe.left}px ${format.safe.bottom}px`,
        gap: 28 * scale,
      }}
    >
      {badge && <Badge tone="plain">{badge}</Badge>}
      {headline && (
        <Text role="title" align="center" animate={{ delay: 2 }} maxWidth={format.width * 0.84}>
          {headline}
        </Text>
      )}
      {subject && (
        <div
          style={{
            transform: `scale(${pulse}) translateY(${drift}px)`,
            ...enter(frame, fps, style.motion, { delay: 5 }),
          }}
        >
          {tone === "panel" ? <Panel animate={false}>{subject}</Panel> : subject}
        </div>
      )}
      {caption && (
        <Text role="body" tone="soft" align="center" animate={{ delay: 12 }} maxWidth={format.width * 0.78}>
          {caption}
        </Text>
      )}
    </AbsoluteFill>
  );
};

export const stageLayout = defineLayout({
  name: "stage",
  summary: "One centred subject with an optional headline and caption.",
  useWhen: "The default. Use when a scene is about a single thing and needs no structure.",
  schema,
  component: Stage,
  example: `:: stage { headline: "Meet Nova", glyph: "🤖", caption: "Your support agent" }`,
});
