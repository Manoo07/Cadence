/**
 * Caption themes.
 *
 * Each receives the current page, the clock, and tokens; each decides how to
 * mark the word being spoken. The mark is the whole design: it is what makes a
 * muted viewer follow the sentence rather than read it.
 */

import React from "react";
import type { CaptionPage } from "../../core/captions.ts";
import type { StylePack } from "../../kit/tokens.ts";

export type ThemeProps = {
  page: CaptionPage;
  nowMs: number;
  style: StylePack;
  scale: number;
};

const isActive = (token: { startMs: number; endMs: number }, nowMs: number): boolean =>
  nowMs >= token.startMs && nowMs < token.endMs;

const isSpoken = (token: { endMs: number }, nowMs: number): boolean => nowMs >= token.endMs;

/**
 * selection — the reference video's motif: the live word sits inside a text
 * selection box with drag handles, as if someone were highlighting it in an
 * editor. It reads as "this exact word", and it is unusual enough to become
 * the video's signature.
 */
export const SelectionCaption: React.FC<ThemeProps> = ({ page, nowMs, style, scale }) => {
  const { palette, type, shape } = style;
  const handle = 11 * scale;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: `${6 * scale}px ${14 * scale}px`,
        fontFamily: type.caption,
        fontSize: type.size.caption * scale,
        fontWeight: type.weight.bold,
        letterSpacing: `${type.tracking.tight}em`,
        lineHeight: 1.18,
        maxWidth: "100%",
      }}
    >
      {page.words.map((token, i) => {
        const text = token.text.trim();
        if (text === "") return null;
        const active = isActive(token, nowMs);
        const spoken = isSpoken(token, nowMs);

        return (
          <span
            key={`${i}-${text}`}
            style={{
              position: "relative",
              color: active ? palette.ink : spoken ? palette.ink : palette.inkFaint,
              opacity: active || spoken ? 1 : 0.55,
              background: active ? "rgba(46,88,232,0.18)" : "transparent",
              outline: active ? `${2 * scale}px solid ${palette.cool}` : "none",
              borderRadius: active ? 3 * scale : 0,
              padding: active ? `${2 * scale}px ${4 * scale}px` : 0,
              margin: active ? `0 ${-4 * scale}px` : 0,
              transition: "none",
            }}
          >
            {text}
            {active && (
              <>
                <Handle style={{ left: -handle / 2, top: -handle / 2 }} size={handle} color={palette.cool} />
                <Handle
                  style={{ right: -handle / 2, bottom: -handle / 2 }}
                  size={handle}
                  color={palette.cool}
                />
              </>
            )}
          </span>
        );
      })}
    </div>
  );
};

const Handle: React.FC<{ style: React.CSSProperties; size: number; color: string }> = ({
  style,
  size,
  color,
}) => (
  <span
    style={{
      position: "absolute",
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      border: `${Math.max(1, size * 0.16)}px solid #FFFFFF`,
      ...style,
    }}
  />
);

/** karaoke — the spoken word is filled with the accent colour; the rest dims. */
export const KaraokeCaption: React.FC<ThemeProps> = ({ page, nowMs, style, scale }) => {
  const { palette, type } = style;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: `${4 * scale}px ${16 * scale}px`,
        fontFamily: type.caption,
        fontSize: type.size.caption * scale,
        fontWeight: type.weight.black,
        textAlign: "center",
        lineHeight: 1.16,
        letterSpacing: `${type.tracking.tight}em`,
      }}
    >
      {page.words.map((token, i) => {
        const text = token.text.trim();
        if (text === "") return null;
        const active = isActive(token, nowMs);
        return (
          <span
            key={`${i}-${text}`}
            style={{
              color: active ? palette.accent : palette.ink,
              transform: active ? `scale(1.06)` : "scale(1)",
              display: "inline-block",
              textShadow: `0 ${3 * scale}px 0 rgba(20,22,26,0.10)`,
            }}
          >
            {text}
          </span>
        );
      })}
    </div>
  );
};

/** block — a solid plate behind the whole page. Maximum legibility over art. */
export const BlockCaption: React.FC<ThemeProps> = ({ page, nowMs, style, scale }) => {
  const { palette, type, shape } = style;

  return (
    <div
      style={{
        background: palette.ink,
        color: palette.bg,
        padding: `${14 * scale}px ${24 * scale}px`,
        borderRadius: shape.radius.sm * scale,
        fontFamily: type.caption,
        fontSize: type.size.caption * 0.78 * scale,
        fontWeight: type.weight.bold,
        textAlign: "center",
        lineHeight: 1.26,
        maxWidth: "94%",
      }}
    >
      {page.words.map((token, i) => {
        const text = token.text.trim();
        if (text === "") return null;
        const active = isActive(token, nowMs);
        return (
          <span key={`${i}-${text}`} style={{ color: active ? palette.warn : palette.bg }}>
            {text}{" "}
          </span>
        );
      })}
    </div>
  );
};
