/**
 * title — a full-frame statement.
 *
 * The opener, the turn, the closer. One idea, set large. Resist the urge to
 * add a subtitle to every one of these; the narration is already saying it.
 */

import React from "react";
import { z } from "zod";
import { AbsoluteFill } from "remotion";
import { Badge, Text, useScene } from "../kit/index.ts";
import { beatPulse } from "../kit/motion.ts";
import { defineLayout } from "./types.ts";

const schema = z.object({
  text: z.string().describe("The statement. Keep it under ~8 words."),
  eyebrow: z.string().optional().describe("Small mono label above, e.g. a chapter name."),
  subtitle: z.string().optional().describe("One supporting line. Use sparingly."),
  align: z.enum(["left", "center"]).default("center"),
  tone: z.enum(["ink", "accent", "cool"]).default("ink"),
});

const Title: React.FC<z.infer<typeof schema>> = ({
  text,
  eyebrow,
  subtitle,
  align = "center",
  tone = "ink",
}) => {
  const { frame, beats, format, scale, style } = useScene();
  const pulse = beatPulse(frame, beats, { amount: 0.03 });

  /**
   * Shrink long statements to fit rather than overflowing.
   *
   * A title layout that only holds four words forces the author to weaken
   * their best line to satisfy the layout — exactly backwards. Display type
   * is meant to flex: a short statement stays huge, a full sentence steps
   * down to something that still reads as display but fits the frame.
   */
  const fit =
    text.length <= 28 ? 1
    : text.length <= 44 ? 0.82
    : text.length <= 62 ? 0.66
    : 0.54;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: align === "center" ? "center" : "flex-start",
        padding: `0 ${format.safe.left}px`,
        paddingBottom: format.safe.bottom * 0.5,
        gap: 22 * scale,
        transform: `scale(${pulse})`,
      }}
    >
      {eyebrow && (
        <Badge tone="plain" animate={{ delay: 0 }}>
          {eyebrow}
        </Badge>
      )}
      <Text
        role="hero"
        tone={tone}
        align={align}
        animate={{ delay: 4 }}
        maxWidth={format.width - format.safe.left * 2}
        style={{ fontSize: style.type.size.hero * fit * scale }}
      >
        {text}
      </Text>
      {subtitle && (
        <Text role="body" tone="soft" align={align} animate={{ delay: 10 }} maxWidth={format.width * 0.78}>
          {subtitle}
        </Text>
      )}
    </AbsoluteFill>
  );
};

export const titleLayout = defineLayout({
  name: "title",
  summary: "A full-frame statement, set large.",
  useWhen: "Opening, closing, or a hard pivot in the argument. One idea only.",
  schema,
  component: Title,
  example: `:: title { text: "Every company wants its own AI", eyebrow: "01 · the problem" }`,
});
