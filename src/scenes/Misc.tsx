/**
 * The remaining layouts: quote, grid, device, bubbles.
 *
 * Each is small enough that keeping them together is clearer than four more
 * files, and they share the same shape: schema, component, definition.
 */

import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { z } from "zod";
import { Badge, Bubble, Chrome, Panel, Stamp, Text, useScene } from "../kit/index.ts";
import { enter, popIn, stagger } from "../kit/motion.ts";
import { defineLayout } from "./types.ts";

// ------------------------------------------------------------------- quote

const quoteSchema = z.object({
  text: z.string(),
  attribution: z.string().optional(),
  /** Stamped over the quote, e.g. "WRONG". Lands on the first emphasis beat. */
  stamp: z.string().optional(),
});

const Quote: React.FC<z.infer<typeof quoteSchema>> = ({ text, attribution, stamp }) => {
  const { style, beats, format, scale } = useScene();
  const { palette, shape, type } = style;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: `${format.safe.top}px ${format.safe.left}px ${format.safe.bottom}px`,
        gap: 24 * scale,
      }}
    >
      <div style={{ position: "relative" }}>
        <div
          style={{
            borderLeft: `${6 * scale}px solid ${palette.accent}`,
            paddingLeft: 28 * scale,
            fontFamily: type.sans,
            fontSize: type.size.title * scale,
            fontWeight: type.weight.medium,
            color: palette.ink,
            lineHeight: 1.18,
            letterSpacing: `${type.tracking.tight}em`,
          }}
        >
          {text}
        </div>
        {stamp && (
          <div style={{ position: "absolute", right: -20 * scale, bottom: -40 * scale }}>
            <Stamp text={stamp} at={beats[0] ?? 18} />
          </div>
        )}
      </div>
      {attribution && (
        <Text role="label" tone="soft" mono align="center" animate={{ delay: 12 }}>
          {`— ${attribution}`}
        </Text>
      )}
    </AbsoluteFill>
  );
};

export const quoteLayout = defineLayout({
  name: "quote",
  summary: "A pulled quote, optionally stamped.",
  useWhen: "Quoting a belief you are about to dismantle, or a line worth dwelling on.",
  schema: quoteSchema,
  component: Quote,
  example: `:: quote { text: "Just fine-tune it on our docs.", stamp: "wrong" }`,
});

// -------------------------------------------------------------------- grid

const gridSchema = z.object({
  items: z
    .array(z.object({ label: z.string(), glyph: z.string().optional(), tone: z.enum(["plain", "accent", "cool", "good", "ink"]).default("plain") }))
    .min(2)
    .max(9),
  headline: z.string().optional(),
  /** Small mono label above the headline, naming the section. */
  eyebrow: z.string().optional(),
  columns: z.number().int().min(2).max(3).default(3),
});

const Grid: React.FC<z.infer<typeof gridSchema>> = ({ items, headline, eyebrow, columns = 3 }) => {
  const { style, frame, fps, format, scale } = useScene();
  const { palette, shape, type } = style;

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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 16 * scale,
          width: "100%",
        }}
      >
        {items.map((item, i) => {
          const bg =
            item.tone === "accent" ? palette.accent
            : item.tone === "cool" ? palette.cool
            : item.tone === "good" ? palette.good
            : item.tone === "ink" ? palette.ink
            : palette.raised;
          const fg = item.tone === "plain" ? palette.ink : palette.bg;
          return (
            <div
              key={item.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10 * scale,
                aspectRatio: "1 / 0.82",
                background: bg,
                color: fg,
                border: `${shape.stroke * scale}px solid ${palette.ink}`,
                borderRadius: shape.radius.md * scale,
                boxShadow: shape.shadow,
                padding: 14 * scale,
                boxSizing: "border-box",
                ...popIn(frame, fps, style.motion, { delay: stagger(i, style.motion) }),
              }}
            >
              {item.glyph && <span style={{ fontSize: 64 * scale, lineHeight: 1 }}>{item.glyph}</span>}
              <span
                style={{
                  fontFamily: type.mono,
                  fontSize: type.size.micro * scale,
                  letterSpacing: `${type.tracking.wide}em`,
                  textTransform: "uppercase",
                  textAlign: "center",
                }}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const gridLayout = defineLayout({
  name: "grid",
  summary: "A grid of small labelled tiles.",
  useWhen: "Listing capabilities, tools, or options where order does not matter.",
  schema: gridSchema,
  component: Grid,
  example: `:: grid { columns: 3, items: [{ label: "search", glyph: "🔍" }, { label: "refund", glyph: "💸" }, { label: "email", glyph: "✉️" }] }`,
});

// ------------------------------------------------------------------ device

const deviceSchema = z.object({
  kind: z.enum(["browser", "phone", "terminal", "inbox", "card"]).default("browser"),
  title: z.string().default(""),
  headline: z.string().optional(),
  /** Image under assets/, shown inside the chrome. */
  image: z.string().optional(),
  /** Plain text body, when there is no screenshot. */
  body: z.array(z.string()).default([]),
  badge: z.string().optional(),
});

const Device: React.FC<z.infer<typeof deviceSchema>> = ({
  kind = "browser",
  title = "",
  headline,
  image,
  body = [],
  badge,
}) => {
  const { style, frame, fps, format, scale } = useScene();
  const { palette, type } = style;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: `${format.safe.top}px ${format.safe.left}px ${format.safe.bottom}px`,
        gap: 24 * scale,
      }}
    >
      {headline && (
        <Text role="heading" align="center" animate={{ delay: 0 }}>
          {headline}
        </Text>
      )}
      {badge && <Badge tone="accent">{badge}</Badge>}
      <Chrome kind={kind} title={title} width="100%">
        {image ? (
          <Img src={staticFile(image)} style={{ width: "100%", objectFit: "contain" }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 * scale }}>
            {body.map((line, i) => (
              <div
                key={line}
                style={{
                  fontFamily: kind === "terminal" ? type.mono : type.sans,
                  fontSize: type.size.label * scale,
                  color: kind === "terminal" ? "rgba(251,248,245,0.9)" : palette.ink,
                  ...enter(frame, fps, style.motion, { delay: stagger(i, style.motion, 4) }),
                }}
              >
                {line}
              </div>
            ))}
          </div>
        )}
      </Chrome>
    </AbsoluteFill>
  );
};

export const deviceLayout = defineLayout({
  name: "device",
  summary: "Content framed in browser, phone, terminal or inbox chrome.",
  useWhen: "Making something feel like a real product surface — an email, a dashboard, a CLI session.",
  schema: deviceSchema,
  component: Device,
  example: `:: device { kind: "inbox", title: "support@parcelco", body: ["From: sam@mail.com", "Late parcel :("] }`,
});

// ----------------------------------------------------------------- bubbles

const bubblesSchema = z.object({
  bubbles: z
    .array(
      z.object({
        text: z.string(),
        tone: z.enum(["plain", "accent", "cool", "ink"]).default("plain"),
        /** Rough placement, 0-100 across the frame. */
        x: z.number().min(0).max(100).default(50),
        y: z.number().min(0).max(100).default(50),
      }),
    )
    .min(1)
    .max(6),
  headline: z.string().optional(),
  /** Frames between each bubble popping in. */
  cadence: z.number().int().default(8),
});

const Bubbles: React.FC<z.infer<typeof bubblesSchema>> = ({ bubbles, headline, cadence = 8 }) => {
  const { format, scale } = useScene();

  return (
    <AbsoluteFill
      style={{ padding: `${format.safe.top}px ${format.safe.left}px ${format.safe.bottom}px` }}
    >
      {headline && (
        <Text role="heading" align="center" animate={{ delay: 0 }} style={{ width: "100%" }}>
          {headline}
        </Text>
      )}
      <div style={{ position: "relative", flex: 1 }}>
        {bubbles.map((b, i) => (
          <div
            key={b.text}
            style={{
              position: "absolute",
              left: `${b.x}%`,
              top: `${b.y}%`,
              transform: "translate(-50%, -50%)",
              maxWidth: format.width * 0.62,
            }}
          >
            <Bubble tone={b.tone ?? "plain"} animate={{ delay: i * cadence }}>
              {b.text}
            </Bubble>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const bubblesLayout = defineLayout({
  name: "bubbles",
  summary: "Scattered speech bubbles popping in one after another.",
  useWhen: "A chorus of voices — everyone asking the same thing, many objections at once.",
  schema: bubblesSchema,
  component: Bubbles,
  example: `:: bubbles { bubbles: [{ text: "we need AI!", x: 30, y: 30 }, { text: "our own AI!", x: 65, y: 50, tone: "accent" }] }`,
});
