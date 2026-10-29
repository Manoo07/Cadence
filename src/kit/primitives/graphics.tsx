/**
 * Graphic primitives — bubbles, stamps, connectors, texture.
 *
 * These are the pieces that make a frame feel illustrated rather than
 * laid out. All SVG, all themed, all animatable from a beat.
 */

import React from "react";
import { useScene } from "../context.tsx";
import { drawPath, enter, popIn, type EnterOptions } from "../motion.ts";

export type BubbleProps = {
  children: React.ReactNode;
  tone?: "plain" | "accent" | "cool" | "ink";
  /** Where the tail points. `none` makes it a thought cloud. */
  tail?: "bottom" | "top" | "left" | "right" | "none";
  animate?: EnterOptions | false;
  style?: React.CSSProperties;
};

/** A speech bubble. The reference leans on these heavily to voice characters. */
export const Bubble: React.FC<BubbleProps> = ({
  children,
  tone = "plain",
  tail = "bottom",
  animate = {},
  style: override,
}) => {
  const { style, frame, fps, scale } = useScene();
  const { palette, shape, type } = style;

  const bg =
    tone === "accent" ? palette.accent
    : tone === "cool" ? palette.cool
    : tone === "ink" ? palette.ink
    : palette.raised;
  const fg = tone === "plain" ? palette.ink : palette.bg;

  const animation = animate === false ? {} : popIn(frame, fps, style.motion, animate);
  const size = 16 * scale;

  const tailStyle: React.CSSProperties =
    tail === "none"
      ? {}
      : {
          position: "absolute",
          width: 0,
          height: 0,
          borderStyle: "solid",
          ...(tail === "bottom" && {
            bottom: -size,
            left: "22%",
            borderWidth: `${size}px ${size * 0.7}px 0 ${size * 0.7}px`,
            borderColor: `${palette.ink} transparent transparent transparent`,
          }),
          ...(tail === "top" && {
            top: -size,
            left: "22%",
            borderWidth: `0 ${size * 0.7}px ${size}px ${size * 0.7}px`,
            borderColor: `transparent transparent ${palette.ink} transparent`,
          }),
          ...(tail === "left" && {
            left: -size,
            top: "40%",
            borderWidth: `${size * 0.7}px ${size}px ${size * 0.7}px 0`,
            borderColor: `transparent ${palette.ink} transparent transparent`,
          }),
          ...(tail === "right" && {
            right: -size,
            top: "40%",
            borderWidth: `${size * 0.7}px 0 ${size * 0.7}px ${size}px`,
            borderColor: `transparent transparent transparent ${palette.ink}`,
          }),
        };

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        background: bg,
        color: fg,
        border: `${shape.stroke * scale}px solid ${palette.ink}`,
        borderRadius: shape.radius.lg * scale,
        padding: `${16 * scale}px ${26 * scale}px`,
        fontFamily: type.sans,
        fontSize: type.size.body * scale,
        fontWeight: type.weight.bold,
        boxShadow: shape.shadow,
        ...animation,
        ...override,
      }}
    >
      {children}
      {tail !== "none" && <span style={tailStyle} />}
    </div>
  );
};

export type StampProps = {
  text: string;
  /** Frame to land on — pass a beat so it hits the spoken word. */
  at?: number;
  rotate?: number;
  style?: React.CSSProperties;
};

/**
 * A rubber stamp slamming down. Pure punctuation — used once or twice in a
 * video, on the line that matters most.
 */
export const Stamp: React.FC<StampProps> = ({ text, at = 0, rotate = -8, style: override }) => {
  const { style, frame, scale } = useScene();
  const { palette, type, shape } = style;

  const since = frame - at;
  if (since < 0) return null;

  // Overshoot and settle: big, fast, then a small bounce back.
  const t = Math.min(1, since / 8);
  const overshoot = 1 + (1 - t) * (1 - t) * 1.4;
  const opacity = Math.min(1, since / 3);

  return (
    <div
      style={{
        display: "inline-block",
        transform: `rotate(${rotate}deg) scale(${overshoot})`,
        border: `${shape.stroke * 1.6 * scale}px solid ${palette.accent}`,
        borderRadius: shape.radius.sm * scale,
        padding: `${10 * scale}px ${22 * scale}px`,
        color: palette.accent,
        fontFamily: type.sans,
        fontWeight: type.weight.black,
        fontSize: type.size.heading * scale,
        letterSpacing: `${type.tracking.wide}em`,
        textTransform: "uppercase",
        opacity: 0.88 * opacity,
        ...override,
      }}
    >
      {text}
    </div>
  );
};

export type ConnectorProps = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** 0-1 draw progress; wire this to a ramp so the line draws itself on. */
  progress?: number;
  tone?: "ink" | "accent" | "cool" | "faint";
  dashed?: boolean;
  arrow?: boolean;
  /** Curvature; 0 is a straight line. */
  bend?: number;
};

/** An arrow between two points, able to draw itself on. */
export const Connector: React.FC<ConnectorProps> = ({
  from,
  to,
  progress = 1,
  tone = "ink",
  dashed = false,
  arrow = true,
  bend = 0.2,
}) => {
  const { style, scale } = useScene();
  const { palette, shape } = style;

  const color =
    tone === "accent" ? palette.accent
    : tone === "cool" ? palette.cool
    : tone === "faint" ? palette.inkFaint
    : palette.ink;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const mx = from.x + dx / 2 - dy * bend;
  const my = from.y + dy / 2 + dx * bend;
  const d = `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;

  const length = Math.hypot(dx, dy) * (1 + Math.abs(bend));
  const id = `arrow-${tone}-${Math.round(from.x)}-${Math.round(to.y)}`;

  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
      pointerEvents="none"
    >
      {arrow && (
        <defs>
          <marker
            id={id}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        </defs>
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={shape.stroke * scale}
        strokeLinecap="round"
        markerEnd={arrow && progress > 0.92 ? `url(#${id})` : undefined}
        {...(dashed
          ? { strokeDasharray: `${10 * scale} ${8 * scale}` }
          : drawPath(progress, length))}
        opacity={dashed ? progress : 1}
      />
    </svg>
  );
};

/**
 * Paper grain and vignette.
 *
 * A perfectly flat digital background reads as sterile. A few percent of noise
 * is the difference between "a web page" and "a printed thing".
 */
export const PaperTexture: React.FC = () => {
  const { style, format } = useScene();
  const { grain, vignette } = style.texture;
  if (grain <= 0 && vignette <= 0) return null;

  return (
    <>
      {grain > 0 && (
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: grain, pointerEvents: "none" }}
        >
          <filter id="paper-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#paper-grain)" />
        </svg>
      )}
      {vignette > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(ellipse at center, transparent 55%, rgba(20,22,26,${vignette}) 100%)`,
          }}
        />
      )}
    </>
  );
};

/**
 * Thin progress bar showing position through the video.
 *
 * Takes its colour explicitly rather than from scene context, because it lives
 * above the scenes at video level where no SceneProvider is mounted.
 */
export const Progress: React.FC<{
  progress: number;
  color: string;
  height?: number;
}> = ({ progress, color, height = 5 }) => (
  <div
    style={{
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height,
      background: "rgba(20,22,26,0.07)",
    }}
  >
    <div
      style={{
        width: `${Math.min(100, Math.max(0, progress * 100))}%`,
        height: "100%",
        background: color,
      }}
    />
  </div>
);
