/**
 * custom — the escape hatch.
 *
 * When no layout fits, a project supplies its own React component and the
 * registry gets out of the way. The component is registered at startup by the
 * project's `scenes/index.ts`, so the spec stays declarative: the script names
 * a component, it does not embed code.
 */

import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { Text, useScene } from "../kit/index.ts";
import { defineLayout } from "./types.ts";

const schema = z.object({
  component: z.string().describe("Name registered by the project's scenes/index.ts."),
  props: z.record(z.string(), z.unknown()).default({}),
});

/** Project-supplied components, keyed by the name scripts refer to. */
const customComponents = new Map<string, React.FC<Record<string, unknown>>>();

export const registerComponent = (
  name: string,
  component: React.FC<any>,
): void => {
  customComponents.set(name, component as React.FC<Record<string, unknown>>);
};

export const hasComponent = (name: string): boolean => customComponents.has(name);

export const registeredComponents = (): string[] => [...customComponents.keys()];

const Custom: React.FC<z.infer<typeof schema>> = ({ component, props = {} }) => {
  const { style, format, scale } = useScene();
  const Component = customComponents.get(component);

  if (!Component) {
    // Fail loudly in-frame rather than rendering an empty scene, so a missing
    // registration is obvious in the proof sheet instead of at review time.
    return (
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: format.safe.left,
          gap: 16 * scale,
        }}
      >
        <Text role="heading" tone="accent" align="center">
          Unknown component
        </Text>
        <Text role="body" tone="soft" mono align="center">
          {component}
        </Text>
        <Text role="micro" tone="faint" align="center" maxWidth={format.width * 0.7}>
          {registeredComponents().length > 0
            ? `Registered: ${registeredComponents().join(", ")}`
            : "No components registered. Call registerComponent() in your project's scenes/index.ts."}
        </Text>
      </AbsoluteFill>
    );
  }

  return <Component {...props} />;
};

export const customLayout = defineLayout({
  name: "custom",
  summary: "Renders a project-supplied React component.",
  useWhen:
    "Nothing in the catalog fits. Write the component in projects/<name>/scenes/, register it, then reference it by name.",
  schema,
  component: Custom,
  example: `:: custom { component: "IsoCity", props: { buildings: 5 } }`,
});
