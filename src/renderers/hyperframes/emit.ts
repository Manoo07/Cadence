/**
 * HyperFrames backend — emit an HTML composition from a VideoSpec.
 *
 * The spec is renderer-agnostic data: resolved frame numbers, layout names and
 * props, with no React in it. That is what makes a second backend possible at
 * all, and it is worth keeping true.
 *
 * Why have one:
 *   - native <video> clips, so yt-dlp b-roll is a first-class timeline element
 *   - AWS Lambda rendering via @hyperframes/aws-lambda
 *   - a fallback when Remotion's bundled Chrome will not start, which has
 *     already happened once on this machine
 *
 * Scenes are rendered server-side to static markup and animated with GSAP,
 * rather than re-implemented. HyperFrames seeks a paused GSAP timeline per
 * frame, so entrances and camera moves are expressed as tweens instead of as
 * functions of `useCurrentFrame`.
 */

import { groupIntoPages } from "../../core/captions.ts";
import type { SpecScene, VideoSpec } from "../../core/types.ts";
import type { StylePack } from "../../kit/tokens.ts";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const secs = (frames: number, fps: number): number => Number((frames / fps).toFixed(4));

/**
 * Static markup for one scene.
 *
 * This is deliberately a reduced rendering, not a port of the React layouts:
 * the HyperFrames backend exists for footage, Lambda and fallback, and a
 * second full implementation of fifteen layouts would be two sources of truth
 * for the same design. Scenes that must look identical in both backends should
 * be rendered with Remotion.
 */
const sceneMarkup = (scene: SpecScene, style: StylePack, spec: VideoSpec): string => {
  const p = scene.props as Record<string, unknown>;
  const id = `scene-${scene.id}`;

  const text = (key: string): string | null => {
    const v = p[key];
    return typeof v === "string" && v.length > 0 ? esc(v) : null;
  };

  const parts: string[] = [];

  if (scene.layout === "footage" && typeof p["src"] === "string") {
    parts.push(
      `<video class="hf-footage" src="${esc(p["src"])}" muted playsinline ` +
        `data-start="${secs(scene.startFrame, spec.format.fps)}" ` +
        `data-duration="${secs(scene.durationInFrames, spec.format.fps)}"></video>`,
      `<div class="hf-scrim"></div>`,
    );
  }

  const headline = text("headline") ?? text("text");
  if (headline) parts.push(`<h1 class="hf-headline" data-anim>${headline}</h1>`);

  const eyebrow = text("eyebrow") ?? text("badge");
  if (eyebrow) parts.push(`<span class="hf-badge" data-anim>${eyebrow}</span>`);

  // Lists cover stack, pipeline and grid, which is most of the catalog's
  // structure; the detail differs from the Remotion rendering, the meaning does not.
  const items = p["items"] ?? p["steps"];
  if (Array.isArray(items)) {
    const active = typeof p["active"] === "number" ? p["active"] : -1;
    const rows = items
      .map((item, i) => {
        const label = typeof item === "string" ? item : String((item as { label?: string })?.label ?? "");
        return `<li class="hf-row${i === active ? " is-active" : ""}" data-anim>` +
          `<span class="hf-num">${String(i + 1).padStart(2, "0")}</span>${esc(label)}</li>`;
      })
      .join("");
    parts.push(`<ol class="hf-list">${rows}</ol>`);
  }

  const caption = text("caption") ?? text("subtitle");
  if (caption) parts.push(`<p class="hf-caption" data-anim>${caption}</p>`);

  return (
    `<section class="hf-scene clip" id="${id}" ` +
    `data-start="${secs(scene.startFrame, spec.format.fps)}" ` +
    `data-duration="${secs(scene.durationInFrames, spec.format.fps)}" ` +
    `data-track-index="0">` +
    `<span class="hf-label">// ${esc(scene.label)}</span>` +
    `<div class="hf-body">${parts.join("")}</div>` +
    `</section>`
  );
};

/**
 * Captions, as pages that appear one at a time.
 *
 * Emitting every word of the script into the DOM and merely recolouring the
 * live one puts the entire narration on screen at once. Pages are grouped by
 * the same function the Remotion backend uses, each is hidden until its
 * window, and only the words inside the current page are ever visible.
 */
const captionMarkup = (spec: VideoSpec): string => {
  if ((spec.meta.captions ?? "selection") === "none") return "";

  const pages = groupIntoPages(spec.captions);
  if (pages.length === 0) return "";

  const blocks = pages
    .map((page, p) => {
      const words = page.words
        .map(
          (w, i) =>
            `<span class="hf-word" data-from="${(w.startMs / 1000).toFixed(3)}" ` +
            `data-to="${(w.endMs / 1000).toFixed(3)}">${esc(w.text)}</span>`,
        )
        .join("");
      return (
        `<div class="hf-page" id="page-${p}" ` +
        `data-start="${(page.startMs / 1000).toFixed(3)}" ` +
        `data-end="${((page.endMs + 400) / 1000).toFixed(3)}">${words}</div>`
      );
    })
    .join("");

  return `<div class="hf-captions" data-track-index="2">${blocks}</div>`;
};

export const emitHyperframes = (spec: VideoSpec, style: StylePack): string => {
  const { format } = spec;
  const total = secs(spec.durationInFrames, format.fps);
  const { palette, type, shape } = style;

  const scenes = spec.scenes.map((s) => sceneMarkup(s, style, spec)).join("\n    ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(spec.meta.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: ${palette.bg};
    --ink: ${palette.ink};
    --ink-soft: ${palette.inkSoft};
    --ink-faint: ${palette.inkFaint};
    --accent: ${palette.accent};
    --cool: ${palette.cool};
    --raised: ${palette.raised};
    --stroke: ${shape.stroke}px;
    --radius: ${shape.radius.md}px;
    --sans: ${type.sans};
    --mono: ${type.mono};
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--ink); font-family: var(--sans); }
  #stage { position: relative; overflow: hidden; background: var(--bg); }

  .hf-scene { position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: ${format.safe.top}px ${format.safe.left}px ${format.safe.bottom}px; }
  .hf-body { display: flex; flex-direction: column; align-items: center; gap: 28px; width: 100%; }

  .hf-label { position: absolute; top: ${Math.round(format.safe.top * 0.52)}px; left: ${format.safe.left}px;
    font-family: var(--mono); font-size: ${type.size.micro}px; color: var(--ink-faint); letter-spacing: .08em; }

  .hf-headline { font-size: ${type.size.title}px; font-weight: 800; line-height: 1.06;
    letter-spacing: -.02em; text-align: center; max-width: ${format.width - format.safe.left * 2}px; }
  .hf-caption { font-size: ${type.size.body}px; color: var(--ink-soft); text-align: center; }
  .hf-badge { font-family: var(--mono); font-size: ${type.size.micro}px; letter-spacing: .08em;
    text-transform: uppercase; border: 1.5px solid var(--ink); border-radius: ${shape.radius.sm}px;
    padding: 7px 14px; }

  .hf-list { list-style: none; display: flex; flex-direction: column-reverse; gap: 10px; }
  .hf-row { display: flex; align-items: center; gap: 14px; width: 440px; height: 76px; padding: 0 20px;
    background: var(--raised); border: var(--stroke) solid var(--ink); border-radius: ${shape.radius.sm}px;
    font-family: var(--mono); font-size: ${type.size.label}px; letter-spacing: .08em; text-transform: uppercase; }
  .hf-row.is-active { background: var(--accent); color: var(--bg); box-shadow: ${shape.shadow}; }
  .hf-num { opacity: .6; font-size: ${type.size.micro}px; min-width: 28px; }

  .hf-footage { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .hf-scrim { position: absolute; inset: 0;
    background: linear-gradient(to bottom, rgba(20,22,26,.12) 0%, rgba(20,22,26,0) 38%, rgba(20,22,26,.36) 100%); }

  .hf-captions { position: absolute; left: ${format.safe.left}px; right: ${format.safe.right}px;
    bottom: ${Math.round(format.safe.bottom * 0.42)}px; height: ${type.size.caption * 2.4}px; }
  .hf-page { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-wrap: wrap;
    justify-content: center; align-items: flex-end; gap: 6px 14px;
    font-size: ${type.size.caption}px; font-weight: 700; letter-spacing: -.02em; line-height: 1.18;
    visibility: hidden; }
  .hf-word { color: var(--ink-faint); opacity: .55; }
  .hf-word.is-live { color: var(--ink); opacity: 1; background: rgba(46,88,232,.18);
    outline: 2px solid var(--cool); border-radius: 3px; padding: 2px 4px; }
  .hf-word.is-said { color: var(--ink); opacity: 1; }
</style>
</head>
<body>
  <div id="stage"
       data-composition-id="video"
       data-start="0"
       data-duration="${total}"
       data-width="${format.width}"
       data-height="${format.height}"
       data-fps="${format.fps}"
       style="width:${format.width}px;height:${format.height}px">

    ${scenes}
    ${captionMarkup(spec)}

    <audio data-start="0" data-duration="${total}" data-track-index="9"
           data-volume="1" src="${esc(spec.audio.voiceover)}"></audio>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <script>
    // HyperFrames seeks this paused timeline once per frame, so every visual
    // change must be expressed as a tween on it. Nothing may depend on real
    // elapsed time, or the render stops being deterministic.
    const tl = gsap.timeline({ paused: true });

    document.querySelectorAll('.hf-scene').forEach((scene) => {
      const start = parseFloat(scene.dataset.start);
      const duration = parseFloat(scene.dataset.duration);

      tl.set(scene, { autoAlpha: 0 }, 0)
        .to(scene, { autoAlpha: 1, duration: 0.35, ease: 'power2.out' }, start)
        .to(scene, { autoAlpha: 0, duration: 0.35, ease: 'power2.in' }, start + duration - 0.35);

      // Camera push, matching the Remotion backend's default.
      tl.fromTo(scene, { scale: 1 }, { scale: 1.035, duration, ease: 'none' }, start);

      scene.querySelectorAll('[data-anim]').forEach((el, i) => {
        tl.from(el, { autoAlpha: 0, y: 28, duration: 0.5, ease: 'power3.out' }, start + 0.1 + i * 0.1);
      });
    });

    // Captions: one page visible at a time, with the live word marked inside it.
    document.querySelectorAll('.hf-page').forEach((page) => {
      const start = parseFloat(page.dataset.start);
      const end = parseFloat(page.dataset.end);
      tl.set(page, { visibility: 'visible' }, start)
        .set(page, { visibility: 'hidden' }, end);

      page.querySelectorAll('.hf-word').forEach((word) => {
        const from = parseFloat(word.dataset.from);
        const to = parseFloat(word.dataset.to);
        tl.set(word, { className: 'hf-word is-live' }, from)
          .set(word, { className: 'hf-word is-said' }, to);
      });
    });

    tl.set({}, {}, ${total});

    window.__timelines = window.__timelines || {};
    window.__timelines.video = tl;
  </script>
</body>
</html>
`;
};
