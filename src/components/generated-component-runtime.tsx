"use client";

import * as React from "react";
import { validateGeneratedComponentSource, type GeneratedComponentCompatibility } from "@/lib/generated-component-contract";

const componentCache = new Map<string, React.ComponentType<Record<string, unknown>>>();

export function validateGeneratedComponent(code: string): GeneratedComponentCompatibility {
  const sourceCompatibility = validateGeneratedComponentSource(code);
  const errors = [...sourceCompatibility.errors];
  if (errors.length === 0) {
    try {
      compileGeneratedComponent(code);
    } catch (error) {
      errors.push(error instanceof Error ? `Component could not compile: ${error.message}` : "Component could not compile.");
    }
  }
  return { compatible: errors.length === 0, errors: [...new Set(errors)] };
}

export function GeneratedComponentRuntime({ code, props }: { code: string; props: Record<string, unknown> }) {
  const Component = React.useMemo(() => compileGeneratedComponent(code), [code]);
  return React.createElement(Component, props);
}

function compileGeneratedComponent(code: string) {
  const cached = componentCache.get(code);
  if (cached) return cached;
  // Source is accepted only after validateGeneratedComponent() enforces the
  // deterministic UltraCut contract. The same compiled function is used by
  // preview and Remotion export, so localTime produces frame-identical output.
  const factory = new Function("React", `"use strict";\n${code}\nreturn GeneratedComponent;`) as (react: typeof React) => unknown;
  const candidate = factory(React);
  if (typeof candidate !== "function") throw new Error("GeneratedComponent is not a React component.");
  const Component = candidate as React.ComponentType<Record<string, unknown>>;
  componentCache.set(code, Component);
  return Component;
}
