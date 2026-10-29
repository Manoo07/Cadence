/**
 * diagram — labelled nodes joined by arrows, laid out automatically.
 *
 * Authors give nodes and edges; placement is computed. Hand-placing boxes in a
 * script is where diagrams go wrong — an author cannot see the result, so
 * arrows end up crossing labels. Three deterministic arrangements cover almost
 * every explainer diagram, and all of them keep edges clear of node bodies.
 */

import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { Connector, Text, useScene } from "../kit/index.ts";
import { popIn, ramp, stagger } from "../kit/motion.ts";
import { defineLayout } from "./types.ts";

const node = z.object({
  id: z.string(),
  label: z.string(),
  tone: z.enum(["plain", "accent", "cool", "ink", "good"]).default("plain"),
  sub: z.string().optional(),
});

const edge = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  dashed: z.boolean().default(false),
  tone: z.enum(["ink", "accent", "cool", "faint"]).default("ink"),
});

const schema = z.object({
  nodes: z.array(node).min(2).max(7),
  edges: z.array(edge).default([]),
  headline: z.string().optional(),
  /** row = left-to-right, column = top-to-bottom, hub = first node centred. */
  arrange: z.enum(["row", "column", "hub"]).default("column"),
});

type Pos = { x: number; y: number };

/** Deterministic placement, in percentages of the drawing area. */
const layoutNodes = (count: number, arrange: "row" | "column" | "hub"): Pos[] => {
  if (arrange === "hub") {
    const spokes = count - 1;
    return [
      { x: 50, y: 50 },
      ...Array.from({ length: spokes }, (_, i) => {
        const angle = (i / spokes) * Math.PI * 2 - Math.PI / 2;
        return { x: 50 + Math.cos(angle) * 36, y: 50 + Math.sin(angle) * 34 };
      }),
    ];
  }
  const step = 100 / (count + 1);
  return Array.from({ length: count }, (_, i) =>
    arrange === "row" ? { x: step * (i + 1), y: 50 } : { x: 50, y: step * (i + 1) },
  );
};

const Diagram: React.FC<z.infer<typeof schema>> = ({
  nodes,
  edges = [],
  headline,
  arrange = "column",
}) => {
  const { style, frame, fps, format, scale } = useScene();
  const { palette, shape, type } = style;

  const positions = layoutNodes(nodes.length, arrange);
  const index = new Map(nodes.map((n, i) => [n.id, i]));

  const boxW = (arrange === "row" ? 240 : 320) * scale;
  const boxH = 96 * scale;

  // The drawing area, in px, inside the safe region.
  const areaW = format.width - format.safe.left * 2;
  const areaH = format.height - format.safe.top - format.safe.bottom - (headline ? 120 * scale : 0);

  const toPx = (p: Pos) => ({ x: (p.x / 100) * areaW, y: (p.y / 100) * areaH });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: `${format.safe.top}px ${format.safe.left}px ${format.safe.bottom}px`,
        gap: 20 * scale,
      }}
    >
      {headline && (
        <Text role="heading" align="center" animate={{ delay: 0 }}>
          {headline}
        </Text>
      )}

      <div style={{ position: "relative", width: areaW, height: areaH }}>
        {/* Edges draw first, so nodes always sit on top of arrowheads. */}
        {edges.map((e, i) => {
          const a = index.get(e.from);
          const b = index.get(e.to);
          if (a === undefined || b === undefined) return null;
          const from = toPx(positions[a]!);
          const to = toPx(positions[b]!);

          // Stop the arrow at the node's edge rather than its centre.
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const dist = Math.hypot(dx, dy) || 1;
          const inset = (arrange === "row" ? boxW : boxH) / 2 + 10 * scale;
          const trim = { x: (dx / dist) * inset, y: (dy / dist) * inset };

          return (
            <Connector
              key={`${e.from}-${e.to}-${i}`}
              from={{ x: from.x + trim.x, y: from.y + trim.y }}
              to={{ x: to.x - trim.x, y: to.y - trim.y }}
              progress={ramp(frame, stagger(i, style.motion, 10), stagger(i, style.motion, 10) + 14)}
              tone={e.tone ?? "ink"}
              dashed={e.dashed ?? false}
              bend={arrange === "hub" ? 0.08 : 0}
            />
          );
        })}

        {nodes.map((n, i) => {
          const p = toPx(positions[i]!);
          const bg =
            n.tone === "accent" ? palette.accent
            : n.tone === "cool" ? palette.cool
            : n.tone === "ink" ? palette.ink
            : n.tone === "good" ? palette.good
            : palette.raised;
          const fg = n.tone === "plain" ? palette.ink : palette.bg;

          return (
            <div
              key={n.id}
              style={{
                position: "absolute",
                left: p.x - boxW / 2,
                top: p.y - boxH / 2,
                width: boxW,
                minHeight: boxH,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4 * scale,
                background: bg,
                color: fg,
                border: `${shape.stroke * scale}px solid ${palette.ink}`,
                borderRadius: shape.radius.md * scale,
                boxShadow: shape.shadow,
                padding: 12 * scale,
                boxSizing: "border-box",
                ...popIn(frame, fps, style.motion, { delay: stagger(i, style.motion) }),
              }}
            >
              <span
                style={{
                  fontFamily: type.mono,
                  fontSize: type.size.label * scale,
                  fontWeight: type.weight.medium,
                  letterSpacing: `${type.tracking.wide}em`,
                  textAlign: "center",
                }}
              >
                {n.label}
              </span>
              {n.sub && (
                <span style={{ fontFamily: type.sans, fontSize: type.size.micro * scale, opacity: 0.7 }}>
                  {n.sub}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const diagramLayout = defineLayout({
  name: "diagram",
  summary: "Labelled nodes joined by arrows, placed automatically.",
  useWhen:
    "Showing how parts connect. Give nodes and edges only — never coordinates. Use `hub` when one node talks to all the others.",
  schema,
  component: Diagram,
  example: `:: diagram { arrange: "hub", nodes: [{ id: "a", label: "AGENT", tone: "accent" }, { id: "db", label: "VECTOR DB" }, { id: "api", label: "ORDERS API" }], edges: [{ from: "a", to: "db" }, { from: "a", to: "api" }] }`,
});
