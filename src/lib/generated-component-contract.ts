const FORBIDDEN_SOURCE: Array<[RegExp, string]> = [
  [/<[A-Za-z]/, "JSX is not supported; use React.createElement."],
  [/\b(?:import|export|require)\b/, "Imports and modules are not supported."],
  [/\b(?:window|document|globalThis|self|process)\b/, "Browser and process globals are not supported."],
  [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/, "Network access is not supported."],
  [/\b(?:localStorage|sessionStorage|indexedDB|cookie)\b/, "Storage access is not supported."],
  [/\b(?:setTimeout|setInterval|requestAnimationFrame|cancelAnimationFrame)\b/, "Timers are not supported."],
  [/\b(?:Date|performance)\b/, "Wall-clock time is not deterministic."],
  [/Math\.random\b/, "Random values are not deterministic."],
  [/\b(?:eval|Function|constructor|__proto__|prototype)\b/, "Dynamic code and prototype access are not supported."],
  [/\banimation(?:Name|Duration|TimingFunction|Delay|IterationCount)?\s*:/i, "CSS animations are not seek-safe; derive motion from props.localTime."],
  [/\btransition(?:Property|Duration|TimingFunction|Delay)?\s*:/i, "CSS transitions are not seek-safe; derive motion from props.localTime."],
];

export interface GeneratedComponentCompatibility {
  compatible: boolean;
  errors: string[];
}

export function validateGeneratedComponentSource(code: string): GeneratedComponentCompatibility {
  const errors: string[] = [];
  if (!code.trim()) errors.push("Component source is empty.");
  if (code.length > 100_000) errors.push("Component source exceeds the 100 KB runtime limit.");
  if (!/\bfunction\s+GeneratedComponent\s*\(\s*props\s*\)/.test(code)) errors.push("Source must define function GeneratedComponent(props).");
  if (!/React\.createElement\s*\(/.test(code)) errors.push("Source must render with React.createElement.");
  for (const [pattern, message] of FORBIDDEN_SOURCE) if (pattern.test(code)) errors.push(message);
  if (errors.length === 0) {
    try {
      // Compile without executing so malformed AI output is retried before it
      // can be stored as a component artifact or project revision.
      void new Function(`"use strict";\n${code}`);
    } catch (error) {
      errors.push(error instanceof Error ? `Component could not compile: ${error.message}` : "Component could not compile.");
    }
  }
  return { compatible: errors.length === 0, errors: [...new Set(errors)] };
}
