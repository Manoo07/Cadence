/**
 * code — a terminal or editor pane with lines revealed in turn.
 *
 * Deliberately not syntax-highlighted by language. A single accent colour on
 * the lines that matter communicates more, at this size and duration, than
 * full tokenisation ever does.
 */

import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { Chrome, Text, useScene } from "../kit/index.ts";
import { enter, stagger } from "../kit/motion.ts";
import { defineLayout } from "./types.ts";

const schema = z.object({
  lines: z.array(z.string()).min(1).describe("One string per line. Keep under ~44 chars."),
  headline: z.string().optional(),
  title: z.string().default("terminal"),
  /** 0-based line indexes to render in the accent colour. */
  highlight: z.array(z.number().int()).default([]),
  kind: z.enum(["terminal", "browser", "card"]).default("terminal"),
  /** Reveal lines one at a time rather than all together. */
  typed: z.boolean().default(true),
});

const Code: React.FC<z.infer<typeof schema>> = ({
  lines,
  headline,
  title = "terminal",
  highlight = [],
  kind = "terminal",
  typed = true,
}) => {
  const { style, frame, fps, format, scale } = useScene();
  const { palette, type } = style;
  const dark = kind === "terminal";

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

      <Chrome kind={kind} title={title} width="100%">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 * scale }}>
          {lines.map((line, i) => {
            const delay = typed ? stagger(i, style.motion, 4) : 2;
            const isHot = highlight.includes(i);
            return (
              <div
                key={`${i}-${line}`}
                style={{
                  display: "flex",
                  gap: 16 * scale,
                  fontFamily: type.mono,
                  fontSize: type.size.label * scale,
                  color: isHot ? palette.accent : dark ? "rgba(251,248,245,0.88)" : palette.ink,
                  fontWeight: isHot ? type.weight.bold : type.weight.regular,
                  whiteSpace: "pre",
                  ...enter(frame, fps, style.motion, { delay, distance: 8 }),
                }}
              >
                <span style={{ opacity: 0.35, minWidth: 30 * scale, textAlign: "right" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{line}</span>
              </div>
            );
          })}
        </div>
      </Chrome>
    </AbsoluteFill>
  );
};

export const codeLayout = defineLayout({
  name: "code",
  summary: "A terminal or editor pane revealing lines in turn.",
  useWhen: "Showing a prompt, a config, a log, or a command. Use `highlight` for the lines the narration is about.",
  schema,
  component: Code,
  example: `:: code { title: "system prompt", lines: ["You are Nova.","Refund limit: $50."], highlight: [1] }`,
});
