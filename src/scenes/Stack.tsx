/**
 * stack — the accreting spine.
 *
 * This is the most important layout in the catalog for an explainer. The same
 * list persists across many scenes, and each scene adds one row and highlights
 * it. The viewer builds a mental model because the picture of that model is
 * literally assembled in front of them, one piece per scene.
 *
 * In the reference video this is the 01 MODEL -> 08 OBSERVABILITY column, and
 * it is what makes twenty disconnected topics feel like one argument.
 */

import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { Text, useScene } from "../kit/index.ts";
import { enter, popIn, ramp, stagger } from "../kit/motion.ts";
import { defineLayout } from "./types.ts";

const schema = z.object({
  items: z.array(z.string()).describe("Every row, bottom-up. Pass the full list each scene."),
  active: z.number().int().optional().describe("Index of the row to highlight (0-based)."),
  title: z.string().optional(),
  /** Rows beyond this index are dimmed as 'not yet reached'. */
  revealed: z.number().int().optional().describe("How many rows exist yet. Defaults to all."),
  align: z.enum(["left", "center"]).default("center"),
});

const Stack: React.FC<z.infer<typeof schema>> = ({
  items,
  active,
  title,
  revealed,
  align = "center",
}) => {
  const { style, frame, fps, format, scale, durationInFrames } = useScene();
  const { palette, shape, type } = style;

  const shown = revealed ?? items.length;
  const rowHeight = 76 * scale;
  const gap = 10 * scale;

  // The newest row is the one being added this scene, so it gets the entrance.
  const newestIndex = shown - 1;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: align === "center" ? "center" : "flex-start",
        padding: `${format.safe.top}px ${format.safe.left}px ${format.safe.bottom}px`,
        gap: 30 * scale,
      }}
    >
      {title && (
        <Text role="heading" align={align} animate={{ delay: 0 }}>
          {title}
        </Text>
      )}

      <div style={{ display: "flex", flexDirection: "column-reverse", gap }}>
        {items.map((item, i) => {
          const exists = i < shown;
          if (!exists) return null;

          const isActive = active === i;
          const isNewest = i === newestIndex;

          const animation = isNewest
            ? popIn(frame, fps, style.motion, { delay: 2 })
            : enter(frame, fps, style.motion, { delay: stagger(i, style.motion) });

          // Active row slides out slightly — a physical "this one" gesture.
          const nudge = isActive ? ramp(frame, 6, 18) * 10 * scale : 0;

          return (
            <div
              key={item}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14 * scale,
                width: 440 * scale,
                height: rowHeight,
                padding: `0 ${20 * scale}px`,
                boxSizing: "border-box",
                background: isActive ? palette.accent : palette.raised,
                color: isActive ? palette.bg : palette.ink,
                border: `${shape.stroke * scale}px solid ${palette.ink}`,
                borderRadius: shape.radius.sm * scale,
                boxShadow: isActive ? shape.shadow : "none",
                transform: `translateX(${nudge}px)`,
                ...animation,
              }}
            >
              <span
                style={{
                  fontFamily: type.mono,
                  fontSize: type.size.micro * scale,
                  opacity: 0.6,
                  minWidth: 28 * scale,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  fontFamily: type.mono,
                  fontSize: type.size.label * scale,
                  fontWeight: type.weight.medium,
                  letterSpacing: `${type.tracking.wide}em`,
                  textTransform: "uppercase",
                }}
              >
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const stackLayout = defineLayout({
  name: "stack",
  summary: "A vertical list that grows across scenes, with one row highlighted.",
  useWhen:
    "You are building up a system piece by piece. Pass the FULL item list every scene and move `active`; use `revealed` to hide rows not yet introduced.",
  schema,
  component: Stack,
  example: `:: stack { items: ["MODEL","SYSTEM PROMPT","RAG","TOOLS"], revealed: 3, active: 2 }`,
});
