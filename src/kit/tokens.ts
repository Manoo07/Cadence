/**
 * Design tokens. A style pack is data, not code, so swapping the look of every
 * scene is a one-line change in the script frontmatter.
 *
 * Scenes must never hard-code a colour, a radius or a font size. If a scene
 * needs a value that is not here, the value belongs here.
 */

export type Palette = {
  /** Page background. */
  bg: string;
  /** Slightly recessed surface, for panels sitting on the page. */
  surface: string;
  /** Raised surface, for cards sitting on panels. */
  raised: string;
  /** Primary text and the outline weight that defines the whole style. */
  ink: string;
  /** Secondary text. */
  inkSoft: string;
  /** Tertiary text, hairlines. */
  inkFaint: string;
  /** The accent that carries meaning: active states, highlights, alarm. */
  accent: string;
  /** The cool counterpart: links, brand, selection. */
  cool: string;
  /** Success / confirmation. */
  good: string;
  /** Warning. */
  warn: string;
  /** Series colours for charts and multi-item layouts. */
  series: string[];
};

export type Typography = {
  /** Display and body face. */
  sans: string;
  /** Labels, chrome, code — the face that makes the style feel technical. */
  mono: string;
  /** Caption face. */
  caption: string;
  /** Scale in px, at 1080x1920. Scenes multiply by `scale` for other formats. */
  size: {
    hero: number;
    title: number;
    heading: number;
    body: number;
    label: number;
    micro: number;
    caption: number;
  };
  weight: { regular: number; medium: number; bold: number; black: number };
  tracking: { tight: number; normal: number; wide: number };
};

export type Shape = {
  /** Outline width — the single most style-defining number in the pack. */
  stroke: number;
  strokeThin: number;
  radius: { sm: number; md: number; lg: number; pill: number };
  /** Offset drop shadow, as used by flat-vector illustration. */
  shadow: string;
  shadowSoft: string;
};

export type Motion = {
  /** Spring configs, consumed by Remotion's `spring()`. */
  spring: {
    /** Default entrance: settles quickly, barely overshoots. */
    enter: { damping: number; mass: number; stiffness: number };
    /** For accents landing on a spoken word — more snap. */
    pop: { damping: number; mass: number; stiffness: number };
    /** Large objects, slower to move. */
    heavy: { damping: number; mass: number; stiffness: number };
  };
  /** Frames between staggered children. */
  stagger: number;
  /** Default transition length in frames. */
  transitionFrames: number;
  /** Camera push-in, as a scale delta over the scene. */
  cameraAmount: number;
};

export type Texture = {
  /** Paper grain opacity, 0 to disable. */
  grain: number;
  /** Vignette strength, 0 to disable. */
  vignette: number;
};

export type StylePack = {
  name: string;
  palette: Palette;
  type: Typography;
  shape: Shape;
  motion: Motion;
  texture: Texture;
  /** WebGL transitions are powerful but can fail in headless render. */
  allowShaderTransitions: boolean;
  /** Google Fonts to load, with the weights actually used. */
  fonts: { family: string; weights: string[] }[];
};
