/**
 * compare — two columns, explicitly opposed.
 *
 * Symmetry is the point here, unlike `split`. The accent/neutral pairing tells
 * the viewer which side you are arguing for before they read a word.
 */

import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { Badge, Text, useScene } from "../kit/index.ts";
import { enter, stagger } from "../kit/motion.ts";
import { defineLayout } from "./types.ts";

const side = z.object({
  title: z.string(),
  items: z.array(z.string()).default([]),
  tone: z.enum(["plain", "accent", "cool", "good", "ink"]).default("plain"),
});

const schema = z.object({
  left: side,
  right: side,
  headline: z.string().optional(),
  /** Small mono label above the headline, naming the section. */
  eyebrow: z.string().optional(),
  /** Mark drawn between the columns. */
  divider: z.string().default("vs"),
});

const Column: React.FC<z.infer<typeof side> & { delay: number }> = ({
  title,
  items = [],
  tone = "plain",
  delay,
}) => {
  const { style, frame, fps, scale } = useScene();
  const { palette, shape, type } = style;

  const headBg =
    tone === "accent" ? palette.accent
    : tone === "cool" ? palette.cool
    : tone === "good" ? palette.good
    : tone === "ink" ? palette.ink
    : palette.surface;
  const headFg = tone === "plain" ? palette.ink : palette.bg;

  return (
    <div
      style={{
        flex: 1,
        border: `${shape.stroke * scale}px solid ${palette.ink}`,
        borderRadius: shape.radius.md * scale,
        overflow: "hidden",
        background: palette.raised,
        boxShadow: shape.shadow,
        ...enter(frame, fps, style.motion, { delay }),
      }}
    >
      <div
        style={{
          background: headBg,
          color: headFg,
          padding: `${16 * scale}px ${18 * scale}px`,
          fontFamily: type.mono,
          fontSize: type.size.label * scale,
          fontWeight: type.weight.bold,
          letterSpacing: `${type.tracking.wide}em`,
          textTransform: "uppercase",
          borderBottom: `${shape.stroke * scale}px solid ${palette.ink}`,
        }}
      >
        {title}
      </div>
      <div style={{ padding: 20 * scale, display: "flex", flexDirection: "column", gap: 14 * scale }}>
        {items.map((item, i) => (
          <div
            key={item}
            style={{
              fontFamily: type.sans,
              fontSize: type.size.label * scale,
              color: palette.ink,
              ...enter(frame, fps, style.motion, { delay: stagger(i, style.motion, delay + 6) }),
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};

const Compare: React.FC<z.infer<typeof schema>> = ({ left, right, headline, eyebrow, divider = "vs" }) => {
  const { style, format, scale } = useScene();

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: `${format.safe.top}px ${format.safe.left}px ${format.safe.bottom}px`,
        gap: 30 * scale,
      }}
    >
      {eyebrow && <Badge tone="plain">{eyebrow}</Badge>}
      {headline && (
        <Text role="heading" align="center" animate={{ delay: 0 }}>
          {headline}
        </Text>
      )}
      <div style={{ display: "flex", alignItems: "stretch", gap: 18 * scale, width: "100%" }}>
        <Column {...left} delay={3} />
        <div
          style={{
            alignSelf: "center",
            fontFamily: style.type.mono,
            fontSize: style.type.size.label * scale,
            color: style.palette.inkFaint,
            textTransform: "uppercase",
          }}
        >
          {divider}
        </div>
        <Column {...right} delay={9} />
      </div>
    </AbsoluteFill>
  );
};

export const compareLayout = defineLayout({
  name: "compare",
  summary: "Two opposed columns, side by side.",
  useWhen: "Before/after, us/them, naive/correct. Use tone to signal which side you favour.",
  schema,
  component: Compare,
  example: `:: compare { left: { title: "Fine-tune", items: ["Slow","Expensive"] }, right: { title: "RAG", items: ["Instant","Cited"], tone: "good" } }`,
});
