/**
 * chat — messages arriving in sequence.
 *
 * Dialogue is the fastest way to show behaviour. One exchange shows what three
 * sentences of description would only assert.
 */

import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { Chrome, Text, useScene } from "../kit/index.ts";
import { popIn } from "../kit/motion.ts";
import { defineLayout } from "./types.ts";

const message = z.object({
  from: z.enum(["user", "bot", "system"]),
  text: z.string(),
  /** Flags an injected / hostile message — rendered in the alarm colour. */
  danger: z.boolean().default(false),
});

const schema = z.object({
  messages: z.array(message).min(1).max(6),
  headline: z.string().optional(),
  title: z.string().default("chat"),
  /** Frames between each message landing. */
  cadence: z.number().int().default(14),
});

const Chat: React.FC<z.infer<typeof schema>> = ({ messages, headline, title = "chat", cadence = 14 }) => {
  const { style, frame, fps, format, scale } = useScene();
  const { palette, shape, type } = style;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: `${format.safe.top}px ${format.safe.left}px ${format.safe.bottom}px`,
        gap: 26 * scale,
      }}
    >
      {headline && (
        <Text role="heading" align="center" animate={{ delay: 0 }}>
          {headline}
        </Text>
      )}

      <Chrome kind="phone" title={title} width="100%">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 * scale }}>
          {messages.map((m, i) => {
            const delay = i * cadence;
            if (frame < delay - 2) return null;
            const mine = m.from === "user";
            const system = m.from === "system";

            const bg = m.danger ? "#F6E3DC" : system ? palette.surface : mine ? palette.cool : palette.raised;
            const fg = m.danger ? palette.accent : mine ? palette.bg : palette.ink;

            return (
              <div
                key={`${m.from}-${i}`}
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "82%",
                  background: bg,
                  color: fg,
                  border: `${shape.strokeThin * scale}px solid ${m.danger ? palette.accent : palette.ink}`,
                  borderRadius: shape.radius.md * scale,
                  padding: `${14 * scale}px ${18 * scale}px`,
                  fontFamily: system || m.danger ? type.mono : type.sans,
                  fontSize: (system ? type.size.micro : type.size.label) * scale,
                  lineHeight: 1.4,
                  ...popIn(frame, fps, style.motion, { delay }),
                }}
              >
                {m.text}
              </div>
            );
          })}
        </div>
      </Chrome>
    </AbsoluteFill>
  );
};

export const chatLayout = defineLayout({
  name: "chat",
  summary: "A phone conversation where messages land one at a time.",
  useWhen: "Showing a model's behaviour, a support exchange, or an attack. Mark hostile text with danger: true.",
  schema,
  component: Chat,
  example: `:: chat { messages: [{ from: "user", text: "Where is order #812?" }, { from: "bot", text: "Shipped Tuesday." }] }`,
});
