/**
 * pipeline — ordered steps with one active.
 *
 * The conveyor belt. Use it whenever the narration describes a sequence that
 * data moves through. Showing the whole chain while highlighting one link is
 * what stops the viewer losing their place in a multi-step process.
 */

import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { Text, useScene } from "../kit/index.ts";
import { enter, ramp, stagger } from "../kit/motion.ts";
import { defineLayout } from "./types.ts";

const schema = z.object({
  steps: z.array(z.string()).min(2).describe("Step names, in order. Two to six works best."),
  active: z.number().int().optional().describe("Index of the current step (0-based)."),
  title: z.string().optional(),
  caption: z.string().optional().describe("One line under the belt."),
  orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
});

const Pipeline: React.FC<z.infer<typeof schema>> = ({
  steps,
  active,
  title,
  caption,
  orientation = "horizontal",
}) => {
  const { style, frame, fps, format, scale } = useScene();
  const { palette, shape, type } = style;
  const vertical = orientation === "vertical";

  // A token travelling the belt makes the sequence feel like motion, not a list.
  const travel = ramp(frame, 8, 46);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: `${format.safe.top}px ${format.safe.left}px ${format.safe.bottom}px`,
        gap: 36 * scale,
      }}
    >
      {title && (
        <Text role="heading" align="center" animate={{ delay: 0 }}>
          {title}
        </Text>
      )}

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: vertical ? "column" : "row",
          alignItems: "stretch",
          gap: 0,
          width: vertical ? 460 * scale : "100%",
          border: `${shape.stroke * scale}px solid ${palette.ink}`,
          borderRadius: shape.radius.md * scale,
          overflow: "hidden",
          background: palette.ink,
          boxShadow: shape.shadow,
        }}
      >
        {steps.map((step, i) => {
          const isActive = active === i;
          const isPast = active !== undefined && i < active;
          return (
            <div
              key={step}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10 * scale,
                padding: `${22 * scale}px ${12 * scale}px`,
                background: isActive ? palette.accent : palette.ink,
                color: palette.bg,
                opacity: isPast ? 0.55 : 1,
                borderRight:
                  !vertical && i < steps.length - 1
                    ? `${shape.strokeThin * scale}px solid rgba(251,248,245,0.22)`
                    : undefined,
                borderBottom:
                  vertical && i < steps.length - 1
                    ? `${shape.strokeThin * scale}px solid rgba(251,248,245,0.22)`
                    : undefined,
                ...enter(frame, fps, style.motion, { delay: stagger(i, style.motion) }),
              }}
            >
              <span style={{ fontFamily: type.mono, fontSize: type.size.micro * scale, opacity: 0.6 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  fontFamily: type.mono,
                  fontSize: type.size.label * scale,
                  fontWeight: type.weight.medium,
                  letterSpacing: `${type.tracking.wide}em`,
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {step}
              </span>
            </div>
          );
        })}

        {/* The travelling token. */}
        {!vertical && (
          <div
            style={{
              position: "absolute",
              top: -9 * scale,
              left: `${travel * 100}%`,
              width: 18 * scale,
              height: 18 * scale,
              marginLeft: -9 * scale,
              borderRadius: "50%",
              background: palette.cool,
              border: `${shape.strokeThin * scale}px solid ${palette.ink}`,
              opacity: travel > 0 && travel < 1 ? 1 : 0,
            }}
          />
        )}
      </div>

      {caption && (
        <Text role="body" tone="soft" align="center" animate={{ delay: 14 }}>
          {caption}
        </Text>
      )}
    </AbsoluteFill>
  );
};

export const pipelineLayout = defineLayout({
  name: "pipeline",
  summary: "Ordered steps in a belt, with the current one highlighted.",
  useWhen:
    "The narration walks through a sequence (split -> embed -> store -> retrieve). Keep the same `steps` across scenes and advance `active`.",
  schema,
  component: Pipeline,
  example: `:: pipeline { steps: ["SPLIT","EMBED","STORE","RETRIEVE"], active: 3, caption: "12,480 vectors" }`,
});
