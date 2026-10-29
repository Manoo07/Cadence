/**
 * paper-vector — the default style pack.
 *
 * Colours are sampled from the reference footage rather than eyeballed: the
 * warm paper ground, near-black ink outline, and a terracotta accent against a
 * single cool blue. The look depends on three things staying consistent —
 * a 3px outline on everything, an offset hard shadow, and mono type for all
 * chrome and labels while body copy stays in a geometric sans.
 */

import type { StylePack } from "../tokens.ts";

export const paperVector: StylePack = {
  name: "paper-vector",

  palette: {
    bg: "#FBF8F5",
    surface: "#F3EFE9",
    raised: "#FFFFFF",
    ink: "#14161A",
    inkSoft: "#5A5E66",
    inkFaint: "#A8A49E",
    accent: "#B85838",
    cool: "#2E58E8",
    good: "#189850",
    warn: "#C8A068",
    series: ["#B85838", "#2E58E8", "#189850", "#C8A068", "#7A5AC8", "#2E9BB8"],
  },

  type: {
    sans: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    caption: '"Plus Jakarta Sans", system-ui, sans-serif',
    size: {
      hero: 132,
      title: 96,
      heading: 64,
      body: 44,
      label: 32,
      micro: 24,
      caption: 76,
    },
    weight: { regular: 400, medium: 500, bold: 700, black: 800 },
    tracking: { tight: -0.02, normal: 0, wide: 0.08 },
  },

  shape: {
    stroke: 3,
    strokeThin: 1.5,
    radius: { sm: 8, md: 16, lg: 28, pill: 999 },
    shadow: "4px 5px 0 rgba(20,22,26,0.14)",
    shadowSoft: "0 12px 28px rgba(20,22,26,0.10)",
  },

  motion: {
    spring: {
      enter: { damping: 22, mass: 0.7, stiffness: 140 },
      pop: { damping: 14, mass: 0.5, stiffness: 220 },
      heavy: { damping: 26, mass: 1.4, stiffness: 90 },
    },
    stagger: 3,
    transitionFrames: 12,
    cameraAmount: 0.035,
  },

  texture: { grain: 0.035, vignette: 0.05 },

  // The DOM transitions cover everything this style needs, and they cannot
  // fail the way a GL context can halfway through a long render.
  allowShaderTransitions: false,

  fonts: [
    { family: "Plus Jakarta Sans", weights: ["400", "500", "700", "800"] },
    { family: "JetBrains Mono", weights: ["400", "500", "700"] },
  ],
};
