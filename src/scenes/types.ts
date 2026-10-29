/**
 * The layout contract.
 *
 * A layout is a pure function of props. It receives no frame, no timing and no
 * style as props — those come from scene context — so its prop schema stays
 * purely about content. That is what makes the catalog writable by an LLM: the
 * props are always "what is on screen", never "how does it move".
 */

import type React from "react";
import type { z } from "zod";

export type LayoutDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  /** Name used in scripts: `:: pipeline { ... }` */
  readonly name: string;
  /** One line, shown in the catalog Claude reads. */
  readonly summary: string;
  /** When to reach for this layout rather than a neighbour. */
  readonly useWhen: string;
  readonly schema: S;
  readonly component: React.FC<z.infer<S>>;
  /** A worked example, used in docs and by `video new`. */
  readonly example: string;
};

export const defineLayout = <S extends z.ZodTypeAny>(
  def: LayoutDefinition<S>,
): LayoutDefinition<S> => def;

/**
 * A layout with its schema generic erased.
 *
 * The registry holds layouts of many different shapes, so it stores them at
 * this width and re-validates props through `schema.safeParse` at the edge.
 */
export type AnyLayout = {
  readonly name: string;
  readonly summary: string;
  readonly useWhen: string;
  readonly schema: z.ZodTypeAny;
  readonly component: React.FC<any>;
  readonly example: string;
};
