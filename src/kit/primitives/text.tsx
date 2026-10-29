/**
 * Typographic primitives.
 *
 * Scenes never set a font family or a raw px size; they pick a role. That is
 * what keeps twenty scenes looking like one video.
 */

import React from "react";
import { useScene } from "../context.tsx";
import { enter, type EnterOptions } from "../motion.ts";

export type TextRole = "hero" | "title" | "heading" | "body" | "label" | "micro";

export type TextProps = {
  children?: React.ReactNode;
  role?: TextRole;
  tone?: "ink" | "soft" | "faint" | "accent" | "cool" | "bg";
  weight?: "regular" | "medium" | "bold" | "black";
  mono?: boolean;
  align?: "left" | "center" | "right";
  animate?: EnterOptions | false;
  maxWidth?: number | string;
  style?: React.CSSProperties;
};

export const Text: React.FC<TextProps> = ({
  children,
  role = "body",
  tone = "ink",
  weight,
  mono = false,
  align = "left",
  animate = {},
  maxWidth,
  style: override,
}) => {
  const { style, frame, fps, scale } = useScene();
  const { palette, type } = style;

  const color =
    tone === "soft" ? palette.inkSoft
    : tone === "faint" ? palette.inkFaint
    : tone === "accent" ? palette.accent
    : tone === "cool" ? palette.cool
    : tone === "bg" ? palette.bg
    : palette.ink;

  const defaultWeight: Record<TextRole, keyof typeof type.weight> = {
    hero: "black",
    title: "bold",
    heading: "bold",
    body: "regular",
    label: "medium",
    micro: "medium",
  };

  const animation = animate === false ? {} : enter(frame, fps, style.motion, animate);

  return (
    <div
      style={{
        fontFamily: mono ? type.mono : type.sans,
        fontSize: type.size[role] * scale,
        fontWeight: type.weight[weight ?? defaultWeight[role]],
        color,
        textAlign: align,
        lineHeight: role === "hero" || role === "title" ? 1.06 : 1.32,
        letterSpacing: `${
          mono ? type.tracking.wide : role === "hero" || role === "title" ? type.tracking.tight : type.tracking.normal
        }em`,
        maxWidth,
        ...animation,
        ...override,
      }}
    >
      {children}
    </div>
  );
};

/**
 * The scene label in the top-left ("// 07 — rag").
 *
 * Small, quiet, and present in every scene. It does more than decorate: it
 * tells the viewer the video has structure and they are moving through it.
 */
export const SceneLabel: React.FC<{ label: string }> = ({ label }) => {
  const { style, scale, format } = useScene();
  return (
    <div
      style={{
        position: "absolute",
        top: format.safe.top * 0.52,
        left: format.safe.left,
        fontFamily: style.type.mono,
        fontSize: style.type.size.micro * scale,
        color: style.palette.inkFaint,
        letterSpacing: `${style.type.tracking.wide}em`,
      }}
    >
      {`// ${label}`}
    </div>
  );
};

export type BadgeProps = {
  children: React.ReactNode;
  tone?: "ink" | "accent" | "cool" | "good" | "warn" | "plain";
  animate?: EnterOptions | false;
  style?: React.CSSProperties;
};

/** A small mono tag — the `BANK` / `CLINIC` / `04 RETRIEVE` chip. */
export const Badge: React.FC<BadgeProps> = ({
  children,
  tone = "ink",
  animate = {},
  style: override,
}) => {
  const { style, frame, fps, scale } = useScene();
  const { palette, shape, type } = style;

  const bg =
    tone === "accent" ? palette.accent
    : tone === "cool" ? palette.cool
    : tone === "good" ? palette.good
    : tone === "warn" ? palette.warn
    : tone === "plain" ? palette.raised
    : palette.ink;

  const fg = tone === "plain" ? palette.ink : palette.bg;
  const animation = animate === false ? {} : enter(frame, fps, style.motion, animate);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6 * scale,
        background: bg,
        color: fg,
        fontFamily: type.mono,
        fontSize: type.size.micro * scale,
        fontWeight: type.weight.medium,
        letterSpacing: `${type.tracking.wide}em`,
        padding: `${7 * scale}px ${14 * scale}px`,
        borderRadius: shape.radius.sm * scale,
        border: tone === "plain" ? `${shape.strokeThin * scale}px solid ${palette.ink}` : "none",
        whiteSpace: "nowrap",
        ...animation,
        ...override,
      }}
    >
      {children}
    </span>
  );
};
