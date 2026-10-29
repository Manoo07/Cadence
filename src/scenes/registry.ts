/**
 * The layout registry — the vocabulary available to a script.
 *
 * Adding a layout is one import and one array entry. Everything downstream
 * (validation, the catalog Claude reads, the JSON schema) is generated from
 * this list, so there is no second place to keep in sync.
 */

import { bubblesLayout, deviceLayout, gridLayout, quoteLayout } from "./Misc.tsx";
import { chatLayout } from "./Chat.tsx";
import { codeLayout } from "./Code.tsx";
import { compareLayout } from "./Compare.tsx";
import { customLayout } from "./Custom.tsx";
import { diagramLayout } from "./Diagram.tsx";
import { footageLayout } from "./Footage.tsx";
import { pipelineLayout } from "./Pipeline.tsx";
import { splitLayout } from "./Split.tsx";
import { stackLayout } from "./Stack.tsx";
import { stageLayout } from "./Stage.tsx";
import { statLayout } from "./Stat.tsx";
import { titleLayout } from "./Title.tsx";
import type { AnyLayout, LayoutDefinition } from "./types.ts";

export const LAYOUTS: readonly AnyLayout[] = [
  titleLayout,
  stageLayout,
  splitLayout,
  stackLayout,
  pipelineLayout,
  diagramLayout,
  compareLayout,
  deviceLayout,
  chatLayout,
  codeLayout,
  statLayout,
  quoteLayout,
  gridLayout,
  bubblesLayout,
  footageLayout,
  customLayout,
];

const BY_NAME = new Map(LAYOUTS.map((l) => [l.name, l]));

export const getLayout = (name: string): AnyLayout | undefined =>
  BY_NAME.get(name);

export const layoutNames = (): string[] => LAYOUTS.map((l) => l.name);

/**
 * Validate and fill defaults for one scene's props.
 *
 * Returning the parsed value matters as much as the error: zod applies schema
 * defaults here, so a layout can rely on optional props being present.
 */
export const parseLayoutProps = (
  layout: string,
  props: Record<string, unknown>,
):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; errors: { path: string; message: string }[] } => {
  const def = BY_NAME.get(layout);
  if (!def) {
    return {
      ok: false,
      errors: [
        {
          path: "",
          message: `Unknown layout "${layout}". Available: ${layoutNames().join(", ")}`,
        },
      ],
    };
  }

  const result = def.schema.safeParse(props);
  if (result.success) return { ok: true, value: result.data as Record<string, unknown> };

  return {
    ok: false,
    errors: result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  };
};

export { registerComponent, registeredComponents, hasComponent } from "./Custom.tsx";
export type { AnyLayout, LayoutDefinition } from "./types.ts";
