/**
 * stat — a number that counts up.
 *
 * A number that animates to its value lands harder than one that is simply
 * printed. Where there is an emphasis beat in the narration, the count is
 * timed to finish on the spoken word.
 */

import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { Text, useScene } from "../kit/index.ts";
import { countUp, enter, stagger } from "../kit/motion.ts";
import { defineLayout } from "./types.ts";

const stat = z.object({
  value: z.number(),
  label: z.string(),
  prefix: z.string().default(""),
  suffix: z.string().default(""),
  decimals: z.number().int().default(0),
  tone: z.enum(["ink", "accent", "cool", "good"]).default("ink"),
});

const schema = z.object({
  stats: z.array(stat).min(1).max(3).describe("One to three numbers. One is usually stronger."),
  headline: z.string().optional(),
  caption: z.string().optional(),
});

const Stat: React.FC<z.infer<typeof schema>> = ({ stats, headline, caption }) => {
  const { style, frame, fps, beats, format, scale } = useScene();
  const { palette, type } = style;

  // Finish the count on the first emphasised word, if the script marked one.
  const landAt = beats[0] ?? 26;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: `${format.safe.top}px ${format.safe.left}px ${format.safe.bottom}px`,
        gap: 34 * scale,
      }}
    >
      {headline && (
        <Text role="heading" align="center" animate={{ delay: 0 }}>
          {headline}
        </Text>
      )}

      <div style={{ display: "flex", gap: 56 * scale, flexWrap: "wrap", justifyContent: "center" }}>
        {stats.map((s, i) => {
          const colour =
            s.tone === "accent" ? palette.accent
            : s.tone === "cool" ? palette.cool
            : s.tone === "good" ? palette.good
            : palette.ink;
          const shown = countUp(frame, s.value, {
            from: stagger(i, style.motion, 4),
            to: landAt,
            decimals: s.decimals ?? 0,
          });
          return (
            <div
              key={s.label}
              style={{
                textAlign: "center",
                ...enter(frame, fps, style.motion, { delay: stagger(i, style.motion) }),
              }}
            >
              <div
                style={{
                  fontFamily: type.sans,
                  fontSize: type.size.hero * scale,
                  fontWeight: type.weight.black,
                  color: colour,
                  letterSpacing: `${type.tracking.tight}em`,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {s.prefix}
                {shown.toLocaleString(undefined, {
                  minimumFractionDigits: s.decimals ?? 0,
                  maximumFractionDigits: s.decimals ?? 0,
                })}
                {s.suffix}
              </div>
              <div
                style={{
                  marginTop: 12 * scale,
                  fontFamily: type.mono,
                  fontSize: type.size.micro * scale,
                  color: palette.inkSoft,
                  letterSpacing: `${type.tracking.wide}em`,
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {caption && (
        <Text role="body" tone="soft" align="center" animate={{ delay: 16 }}>
          {caption}
        </Text>
      )}
    </AbsoluteFill>
  );
};

export const statLayout = defineLayout({
  name: "stat",
  summary: "One to three large numbers that count up to their value.",
  useWhen: "The narration states a figure that deserves weight. Mark the figure with ** so the count lands on it.",
  schema,
  component: Stat,
  example: `:: stat { stats: [{ value: 48210, prefix: "$", label: "auto-refunded", tone: "accent" }] }`,
});
