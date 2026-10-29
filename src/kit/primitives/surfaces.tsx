/**
 * Surfaces — the outlined boxes everything else sits in.
 *
 * The flat-vector look comes almost entirely from consistency here: one stroke
 * width, one shadow offset, one radius scale. These components exist so a scene
 * cannot accidentally diverge from that.
 */

import React from "react";
import { useScene } from "../context.tsx";
import { enter, type EnterOptions } from "../motion.ts";

export type PanelProps = {
  children?: React.ReactNode;
  /** Visual weight. `raised` is white, `flat` matches the page. */
  tone?: "raised" | "flat" | "surface" | "ink" | "accent";
  padding?: number;
  radius?: "sm" | "md" | "lg" | "pill";
  width?: number | string;
  height?: number | string;
  shadow?: boolean;
  animate?: EnterOptions | false;
  style?: React.CSSProperties;
};

export const Panel: React.FC<PanelProps> = ({
  children,
  tone = "raised",
  padding = 28,
  radius = "md",
  width,
  height,
  shadow = true,
  animate = {},
  style: override,
}) => {
  const { style, frame, fps, scale } = useScene();
  const { palette, shape } = style;

  const bg =
    tone === "raised" ? palette.raised
    : tone === "flat" ? palette.bg
    : tone === "surface" ? palette.surface
    : tone === "ink" ? palette.ink
    : palette.accent;

  const fg = tone === "ink" || tone === "accent" ? palette.bg : palette.ink;

  const animation = animate === false ? {} : enter(frame, fps, style.motion, animate);

  return (
    <div
      style={{
        boxSizing: "border-box",
        background: bg,
        color: fg,
        border: `${shape.stroke * scale}px solid ${palette.ink}`,
        borderRadius: shape.radius[radius] * scale,
        padding: padding * scale,
        width,
        height,
        boxShadow: shadow ? shape.shadow : "none",
        ...animation,
        ...override,
      }}
    >
      {children}
    </div>
  );
};

export type ChromeKind = "browser" | "terminal" | "phone" | "card" | "inbox";

export type ChromeProps = {
  kind?: ChromeKind;
  /** Shown in the title bar, in mono. */
  title?: string;
  children?: React.ReactNode;
  width?: number | string;
  height?: number | string;
  animate?: EnterOptions | false;
  style?: React.CSSProperties;
};

/**
 * A window frame. Wrapping content in recognisable chrome is a cheap, very
 * effective way to say "this is a real product surface" without drawing one.
 */
export const Chrome: React.FC<ChromeProps> = ({
  kind = "browser",
  title,
  children,
  width = "100%",
  height,
  animate = {},
  style: override,
}) => {
  const { style, scale } = useScene();
  const { palette, shape, type } = style;
  const dark = kind === "terminal";

  const barHeight = (kind === "phone" ? 28 : 44) * scale;

  return (
    <Panel
      tone={dark ? "ink" : "raised"}
      padding={0}
      radius={kind === "phone" ? "lg" : "md"}
      width={width}
      height={height}
      animate={animate}
      style={{ overflow: "hidden", display: "flex", flexDirection: "column", ...override }}
    >
      {kind !== "card" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8 * scale,
            height: barHeight,
            flex: `0 0 ${barHeight}px`,
            padding: `0 ${14 * scale}px`,
            borderBottom: `${shape.strokeThin * scale}px solid ${
              dark ? "rgba(255,255,255,0.18)" : palette.ink
            }`,
            background: dark ? palette.ink : palette.surface,
          }}
        >
          {kind !== "phone" &&
            ["#E0675A", "#E0B04A", "#4FB06A"].map((c) => (
              <span
                key={c}
                style={{
                  width: 11 * scale,
                  height: 11 * scale,
                  borderRadius: "50%",
                  background: c,
                  border: `${shape.strokeThin * scale}px solid ${palette.ink}`,
                }}
              />
            ))}
          {title && (
            <span
              style={{
                marginLeft: kind === "phone" ? 0 : 12 * scale,
                fontFamily: type.mono,
                fontSize: type.size.micro * scale,
                color: dark ? palette.bg : palette.inkSoft,
                letterSpacing: `${type.tracking.wide}em`,
              }}
            >
              {title}
            </span>
          )}
        </div>
      )}
      <div style={{ flex: 1, padding: 22 * scale, minHeight: 0 }}>{children}</div>
    </Panel>
  );
};
