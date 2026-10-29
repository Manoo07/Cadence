/**
 * split — two halves, one subordinate to the other.
 *
 * Not for comparison (use `compare`), but for "here is the thing, and here is
 * what it means". The asymmetric ratio is deliberate: equal halves read as a
 * comparison whether you intend it or not.
 */

import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { z } from "zod";
import { Badge, Panel, Text, useScene } from "../kit/index.ts";
import { enter, stagger } from "../kit/motion.ts";
import { defineLayout } from "./types.ts";

const schema = z.object({
  headline: z.string().optional(),
  bullets: z.array(z.string()).default([]).describe("Short phrases, not sentences. Max 4."),
  image: z.string().optional(),
  glyph: z.string().optional(),
  badge: z.string().optional(),
  /** Which side the visual sits on. */
  media: z.enum(["left", "right", "top"]).default("top"),
});

const Split: React.FC<z.infer<typeof schema>> = ({
  headline,
  bullets = [],
  image,
  glyph,
  badge,
  media = "top",
}) => {
  const { style, frame, fps, format, scale } = useScene();
  const { palette, shape, type } = style;
  // Vertical formats stack; wide formats can sit side by side.
  const stacked = media === "top" || format.height > format.width;

  const visual = image ? (
    <Img src={staticFile(image)} style={{ maxWidth: "100%", maxHeight: 520 * scale, objectFit: "contain" }} />
  ) : glyph ? (
    <div style={{ fontSize: 200 * scale, lineHeight: 1, textAlign: "center" }}>{glyph}</div>
  ) : null;

  const content = (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 * scale, flex: 1 }}>
      {badge && <Badge tone="plain">{badge}</Badge>}
      {headline && (
        <Text role="heading" animate={{ delay: 2 }}>
          {headline}
        </Text>
      )}
      {bullets.map((b, i) => (
        <div
          key={b}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 14 * scale,
            ...enter(frame, fps, style.motion, { delay: stagger(i, style.motion, 8) }),
          }}
        >
          <span
            style={{
              marginTop: 14 * scale,
              width: 12 * scale,
              height: 12 * scale,
              flex: `0 0 ${12 * scale}px`,
              background: palette.accent,
              borderRadius: shape.radius.sm * scale,
            }}
          />
          <span style={{ fontFamily: type.sans, fontSize: type.size.body * scale, color: palette.ink }}>
            {b}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: `${format.safe.top}px ${format.safe.left}px ${format.safe.bottom}px`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: stacked ? "column" : media === "left" ? "row" : "row-reverse",
          alignItems: stacked ? "stretch" : "center",
          gap: 40 * scale,
        }}
      >
        {visual && (
          <div style={{ flex: stacked ? undefined : 1, ...enter(frame, fps, style.motion, { delay: 0 }) }}>
            <Panel animate={false} tone="raised" padding={24}>
              {visual}
            </Panel>
          </div>
        )}
        {content}
      </div>
    </AbsoluteFill>
  );
};

export const splitLayout = defineLayout({
  name: "split",
  summary: "A visual beside or above a short list of points.",
  useWhen: "You need to show something AND annotate it. For A-vs-B, use `compare` instead.",
  schema,
  component: Split,
  example: `:: split { headline: "What changed", bullets: ["No retraining","Answers cite sources"], glyph: "📚" }`,
});
