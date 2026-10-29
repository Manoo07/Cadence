import { describe, expect, it } from "vitest";
import { mockAlignment, toWords } from "./align.ts";
import { compile } from "./compile.ts";
import { parseScript } from "./script.ts";
import { planTimeline } from "./timeline.ts";
import { validate } from "./validate.ts";
import type { VideoSpec } from "./types.ts";

const KNOWN = ["title", "stage", "pipeline", "stack", "custom"];

const specFrom = (script: string, wordsPerMinute = 155): VideoSpec => {
  const parsed = parseScript(script);
  if (!parsed.ok) throw new Error(`parse failed: ${parsed.error[0]?.message}`);
  const built = compile(
    parsed.value,
    toWords(mockAlignment(parsed.value.voiceoverText, { wordsPerMinute })),
    { voiceoverPath: "vo.mp3" },
  );
  if (!built.ok) throw new Error("compile failed");
  return built.value;
};

const head = `---\ntitle: t\nvoice: v\nstyle: paper-vector\nformat: 9x16\n---\n`;

describe("validate", () => {
  it("passes a well-formed video", () => {
    const spec = specFrom(
      `${head}\n## 01 - a\n:: title { text: "Short title" }\nThis is a reasonable line of narration for one scene.\n`,
    );
    const report = validate(spec, { knownLayouts: KNOWN });
    expect(report.ok).toBe(true);
    expect(report.errors).toBe(0);
  });

  it("reports an unknown layout with the available list", () => {
    const spec = specFrom(`${head}\n## 01 - a\n:: nonsense\nSome narration here for the scene.\n`);
    const report = validate(spec, { knownLayouts: KNOWN });
    expect(report.ok).toBe(false);
    const found = report.issues.find((i) => i.code === "layout.unknown");
    expect(found).toBeDefined();
    expect(found!.hint).toContain("title");
  });

  it("surfaces prop schema failures with a path", () => {
    const spec = specFrom(`${head}\n## 01 - a\n:: title\nNarration for this scene goes here.\n`);
    const report = validate(spec, {
      knownLayouts: KNOWN,
      checkProps: () => ({ ok: false, errors: [{ path: "text", message: "Required" }] }),
    });
    const found = report.issues.find((i) => i.code === "props.invalid");
    expect(found).toBeDefined();
    expect(found!.path).toBe("scenes.0.props.text");
    expect(found!.scene).toBe("01-a");
  });

  it("flags text that will overflow, with a character budget", () => {
    const long = "A title that is far too long to possibly fit inside the frame at hero size";
    const spec = specFrom(
      `${head}\n## 01 - a\n:: title { text: "${long}" }\nNarration for this scene goes here.\n`,
    );
    const report = validate(spec, { knownLayouts: KNOWN });
    const found = report.issues.find((i) => i.code === "text.overflow");
    expect(found).toBeDefined();
    expect(found!.hint).toMatch(/characters fit/);
  });

  it("allows a hero title to wrap to several lines", () => {
    const spec = specFrom(
      `${head}\n## 01 - a\n:: title { text: "Every company wants its own AI" }\nNarration for this scene goes here.\n`,
    );
    const report = validate(spec, { knownLayouts: KNOWN });
    expect(report.issues.some((i) => i.code === "text.overflow")).toBe(false);
  });

  it("warns when the voice is speaking too fast to follow", () => {
    // Durations are derived from the audio, so a rushed scene means a genuinely
    // fast delivery — not a short duration pasted over a long line.
    const line = Array.from({ length: 40 }, () => "word").join(" ");
    const spec = specFrom(`${head}\n## 01 - a\n:: stage\n${line}\n`, 400);
    const report = validate(spec, { knownLayouts: KNOWN });
    expect(report.issues.some((i) => i.code === "pacing.rushed")).toBe(true);
  });

  it("does not flag a normal speaking rate as rushed", () => {
    const line = Array.from({ length: 40 }, () => "word").join(" ");
    const spec = specFrom(`${head}\n## 01 - a\n:: stage\n${line}\n`, 155);
    const report = validate(spec, { knownLayouts: KNOWN });
    expect(report.issues.some((i) => i.code === "pacing.rushed")).toBe(false);
  });

  it("warns when a scene holds too long", () => {
    const spec = specFrom(`${head}\n## 01 - a\n:: stage\nShort line.\n`);
    const slow: VideoSpec = {
      ...spec,
      scenes: [{ ...spec.scenes[0]!, durationInFrames: 30 * 20 }],
    };
    const report = validate(slow, { knownLayouts: KNOWN });
    expect(report.issues.some((i) => i.code === "pacing.scene-too-long")).toBe(true);
  });

  it("flags an unregistered custom component", () => {
    const spec = specFrom(
      `${head}\n## 01 - a\n:: custom { component: "Missing" }\nNarration for this scene.\n`,
    );
    const report = validate(spec, { knownLayouts: KNOWN, knownComponents: ["Present"] });
    const found = report.issues.find((i) => i.code === "custom.unregistered");
    expect(found).toBeDefined();
    expect(found!.hint).toContain("Present");
  });

  it("flags a missing asset", () => {
    const spec = specFrom(
      `${head}\n## 01 - a\n:: stage { image: "figures/nope.png" }\nNarration for this scene.\n`,
    );
    const report = validate(spec, { knownLayouts: KNOWN, existingAssets: ["figures/yes.png"] });
    expect(report.issues.some((i) => i.code === "asset.missing")).toBe(true);
  });

  it("emits issues that survive JSON serialisation, since agents read them", () => {
    const spec = specFrom(`${head}\n## 01 - a\n:: nonsense\nNarration for this scene.\n`);
    const report = validate(spec, { knownLayouts: KNOWN });
    const round = JSON.parse(JSON.stringify(report));
    expect(round.issues[0].code).toBe("layout.unknown");
    expect(round.ok).toBe(false);
  });
});

// ---------------------------------------------------------------- timeline

describe("planTimeline", () => {
  it("preserves total duration despite transition overlap", () => {
    const compiled = [90, 120, 150, 60];
    const transitions = [0, 12, 12, 12];
    const plan = planTimeline(compiled, transitions);
    expect(plan.totalInFrames).toBe(compiled.reduce((a, b) => a + b, 0));
  });

  it("stays exact with transitions of differing lengths", () => {
    const compiled = [100, 80, 140, 90, 110];
    const transitions = [0, 6, 24, 1, 18];
    const plan = planTimeline(compiled, transitions);
    expect(plan.totalInFrames).toBe(520);
  });

  it("is a no-op when every cut is hard", () => {
    const compiled = [90, 120, 60];
    const plan = planTimeline(compiled, [0, 0, 0]);
    expect(plan.durations).toEqual(compiled);
    expect(plan.totalInFrames).toBe(270);
  });

  it("pads interior scenes more than the outer ones", () => {
    const plan = planTimeline([100, 100, 100], [0, 20, 20]);
    // First gains half of its outgoing transition, middle gains both halves,
    // last gains only its incoming half.
    expect(plan.durations).toEqual([110, 120, 110]);
  });

  it("never emits a zero-length sequence", () => {
    const plan = planTimeline([1, 1], [0, 0]);
    expect(plan.durations.every((d) => d >= 1)).toBe(true);
  });

  it("does not drift across many scenes, which is the failure it prevents", () => {
    const compiled = Array.from({ length: 40 }, (_, i) => 60 + (i % 7) * 10);
    const transitions = compiled.map((_, i) => (i === 0 ? 0 : 12));
    const plan = planTimeline(compiled, transitions);
    expect(plan.totalInFrames).toBe(compiled.reduce((a, b) => a + b, 0));
  });
});
