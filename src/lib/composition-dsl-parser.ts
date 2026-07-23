import { parseExpression } from "@babel/parser";
import type { Expression, JSXAttribute, JSXElement, JSXExpressionContainer, JSXOpeningElement } from "@babel/types";
import { SHIFT_CUT_PROJECT_FORMAT } from "@/lib/composition-dsl";
import { validateGeneratedComponentSource } from "@/lib/generated-component-contract";

export type ComponentDefinitionResult = {
  name: string;
  description: string;
  code: string;
  propsSchema: unknown[];
};

export type FirstStageResult =
  | { type: "no-changes"; expectedRevision: number; reply: string }
  | { type: "timeline-edit"; expectedRevision: number; reply: string; tracks: Array<Record<string, unknown>>; source: string }
  | { type: "request-component"; expectedRevision: number; reply: string; elementId: string; componentId: string; componentVersion: number; trackId?: string; name?: string; start?: number; duration?: number; params: Record<string, unknown>; source: string };

export type ComponentStageResult = {
  type: "component-edit";
  expectedRevision: number;
  reply: string;
  targetElementId: string;
  baseComponentId: string;
  baseComponentVersion: number;
  component: ComponentDefinitionResult;
  source: string;
};

const RESERVED_ELEMENT_ATTRIBUTES = new Set(["elementId", "id", "name", "componentId", "componentVersion", "assetId", "start", "duration", "trimStart", "trimEnd", "trackId", "expectedRevision", "reply", "baseComponentId", "baseComponentVersion", "targetElementId"]);

function tagName(element: JSXElement | JSXOpeningElement) {
  const name = "openingElement" in element ? element.openingElement.name : element.name;
  return name.type === "JSXIdentifier" ? name.name : "";
}

function children(element: JSXElement, name?: string) {
  return element.children.filter((child): child is JSXElement => child.type === "JSXElement" && (!name || tagName(child) === name));
}

function attributes(opening: JSXOpeningElement) {
  return opening.attributes.filter((item): item is JSXAttribute => item.type === "JSXAttribute" && item.name.type === "JSXIdentifier");
}

function attribute(opening: JSXOpeningElement, name: string) {
  return attributes(opening).find((item) => item.name.type === "JSXIdentifier" && item.name.name === name);
}

function expressionValue(expression: Expression | JSXExpressionContainer["expression"]): unknown {
  if (expression.type === "NumericLiteral" || expression.type === "StringLiteral" || expression.type === "BooleanLiteral") return expression.value;
  if (expression.type === "NullLiteral") return null;
  if (expression.type === "TaggedTemplateExpression"
    && expression.tag.type === "MemberExpression"
    && expression.tag.object.type === "Identifier"
    && expression.tag.object.name === "String"
    && expression.tag.property.type === "Identifier"
    && expression.tag.property.name === "raw"
    && expression.quasi.expressions.length === 0) {
    const raw = (expression.quasi.quasis[0]?.value.raw ?? "").replace(/\\`/g, "`").replace(/\\\$\{/g, "${");
    try { return JSON.parse(raw); } catch { return raw; }
  }
  throw new Error("Only primitive JSX attributes and String.raw JSON/source templates are allowed.");
}

function value(opening: JSXOpeningElement, name: string, required = true): unknown {
  const item = attribute(opening, name);
  if (!item) {
    if (required) throw new Error(`Missing ${name} attribute on ${tagName(opening)}.`);
    return undefined;
  }
  if (!item.value) return true;
  if (item.value.type === "StringLiteral") return item.value.value;
  if (item.value.type !== "JSXExpressionContainer" || item.value.expression.type === "JSXEmptyExpression") throw new Error(`Invalid ${name} attribute.`);
  return expressionValue(item.value.expression);
}

function stringValue(opening: JSXOpeningElement, name: string, fallback?: string) {
  const result = value(opening, name, fallback === undefined);
  if (result === undefined && fallback !== undefined) return fallback;
  if (typeof result !== "string" || !result.trim()) throw new Error(`${name} must be a non-empty string.`);
  return result;
}

function numberValue(opening: JSXOpeningElement, name: string, fallback?: number) {
  const result = value(opening, name, fallback === undefined);
  if (result === undefined) return fallback as number;
  const numeric = typeof result === "string" && result.trim() ? Number(result) : result;
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) throw new Error(`${name} must be a finite number.`);
  return numeric;
}

function boolValue(opening: JSXOpeningElement, name: string) {
  return value(opening, name, false) === true;
}

function parseRoot(source: string) {
  const candidate = source.replace(/^```(?:jsx|tsx|javascript)?\s*/i, "").replace(/\s*```$/, "").trim();
  const expression = parseExpression(candidate, { plugins: ["jsx", "typescript"] });
  if (expression.type !== "JSXElement") throw new Error("Response must be one JSX element.");
  return { candidate, expression };
}

function paramsFrom(opening: JSXOpeningElement) {
  return Object.fromEntries(attributes(opening).flatMap((item) => {
    const name = item.name.type === "JSXIdentifier" ? item.name.name : "";
    if (!name || RESERVED_ELEMENT_ATTRIBUTES.has(name)) return [];
    return [[name, value(opening, name)]];
  }));
}

function parseTracks(parent: JSXElement) {
  return children(parent).map((track) => {
    const trackTag = tagName(track);
    if (trackTag !== "VisualTrack" && trackTag !== "AudioTrack") throw new Error(`Unsupported timeline child ${trackTag}.`);
    const elements = children(track).map((element) => {
      const elementTag = tagName(element);
      if (!["Video", "Image", "Audio", "Text", "Component"].includes(elementTag)) throw new Error(`Unsupported timeline tag ${elementTag}.`);
      const componentId = value(element.openingElement, "componentId", false);
      const assetId = value(element.openingElement, "assetId", false);
      return {
        id: stringValue(element.openingElement, "elementId", stringValue(element.openingElement, "id", `new:${elementTag.toLowerCase()}`)),
        name: stringValue(element.openingElement, "name", elementTag),
        component: elementTag === "Component" ? "GeneratedReactComponent" : `${elementTag}Player`,
        ...(typeof componentId === "string" ? { componentId, componentVersion: numberValue(element.openingElement, "componentVersion", 1) } : {}),
        ...(typeof assetId === "string" ? { mediaId: assetId } : {}),
        startTime: numberValue(element.openingElement, "start"),
        duration: numberValue(element.openingElement, "duration"),
        trimStart: numberValue(element.openingElement, "trimStart", 0),
        trimEnd: numberValue(element.openingElement, "trimEnd", 0),
        params: paramsFrom(element.openingElement),
      };
    });
    return {
      id: stringValue(track.openingElement, "id"),
      name: stringValue(track.openingElement, "name"),
      type: trackTag === "AudioTrack" ? "audio" : "media",
      muted: boolValue(track.openingElement, "muted"),
      hidden: boolValue(track.openingElement, "hidden"),
      locked: boolValue(track.openingElement, "locked"),
      elements,
    };
  });
}

export function parseCompactProject(source: string) {
  const { candidate, expression } = parseRoot(source);
  if (tagName(expression) !== "ShiftCutProject") throw new Error("Root must be ShiftCutProject.");
  if (value(expression.openingElement, "format") !== SHIFT_CUT_PROJECT_FORMAT) throw new Error(`Project format must be ${SHIFT_CUT_PROJECT_FORMAT}.`);
  const timeline = children(expression, "Timeline")[0];
  const assetsRoot = children(expression, "Assets")[0];
  const componentsRoot = children(expression, "Components")[0];
  if (!timeline || !assetsRoot || !componentsRoot) throw new Error("Compact project requires Assets, Components, and Timeline.");
  return {
    source: candidate,
    revision: numberValue(expression.openingElement, "revision"),
    settings: {
      width: numberValue(expression.openingElement, "width"),
      height: numberValue(expression.openingElement, "height"),
      fps: numberValue(expression.openingElement, "fps"),
      background: stringValue(expression.openingElement, "background"),
    },
    assets: children(assetsRoot, "Asset").map((asset) => ({ id: stringValue(asset.openingElement, "id"), kind: stringValue(asset.openingElement, "kind") })),
    components: children(componentsRoot, "ComponentSummary").map((component) => ({ id: stringValue(component.openingElement, "id"), version: numberValue(component.openingElement, "version") })),
    tracks: parseTracks(timeline),
  };
}

export function parseFirstStageResponse(source: string): FirstStageResult {
  const { candidate, expression } = parseRoot(source);
  const root = tagName(expression);
  const expectedRevision = numberValue(expression.openingElement, "expectedRevision");
  const reply = stringValue(expression.openingElement, "reply", root === "RequestComponent" ? "Loading the requested component." : "Done.");
  if (root === "NoChanges") return { type: "no-changes", expectedRevision, reply };
  if (root === "TimelineEdit") return { type: "timeline-edit", expectedRevision, reply, tracks: parseTracks(expression), source: candidate };
  if (root === "RequestComponent") {
    return {
      type: "request-component",
      expectedRevision,
      reply,
      elementId: stringValue(expression.openingElement, "elementId"),
      componentId: stringValue(expression.openingElement, "componentId"),
      componentVersion: numberValue(expression.openingElement, "componentVersion", 1),
      trackId: value(expression.openingElement, "trackId", false) as string | undefined,
      name: value(expression.openingElement, "name", false) as string | undefined,
      start: attribute(expression.openingElement, "start") ? numberValue(expression.openingElement, "start") : undefined,
      duration: attribute(expression.openingElement, "duration") ? numberValue(expression.openingElement, "duration") : undefined,
      params: paramsFrom(expression.openingElement),
      source: candidate,
    };
  }
  throw new Error("First-stage response root must be TimelineEdit, RequestComponent, or NoChanges.");
}

function normalizePropsSchema(value: unknown) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("propsSchema must be an array or JSON Schema object.");
  const properties = (value as Record<string, unknown>).properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) throw new Error("propsSchema JSON Schema must contain properties.");
  return Object.entries(properties as Record<string, unknown>).map(([name, raw]) => {
    const definition = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const type = definition.type === "number" || definition.type === "boolean" || definition.type === "color" ? definition.type : "string";
    return { name, type, ...(definition.default !== undefined ? { default: definition.default } : {}) };
  });
}

export function parseComponentStageResponse(source: string): ComponentStageResult {
  const { candidate, expression } = parseRoot(source);
  if (tagName(expression) !== "ComponentEdit") throw new Error("Focused response root must be ComponentEdit.");
  const definition = children(expression, "ComponentDefinition")[0];
  if (!definition) throw new Error("ComponentEdit requires one ComponentDefinition.");
  const code = stringValue(definition.openingElement, "code");
  const safety = validateGeneratedComponentSource(code);
  if (!safety.compatible) throw new Error(`Unsafe component: ${safety.errors.join(" ")}`);
  const schema = value(definition.openingElement, "propsSchema", false) ?? [];
  const name = stringValue(definition.openingElement, "name", "GeneratedComponent");
  return {
    type: "component-edit",
    expectedRevision: numberValue(expression.openingElement, "expectedRevision"),
    reply: stringValue(expression.openingElement, "reply", "Updated the component."),
    targetElementId: stringValue(expression.openingElement, "targetElementId"),
    baseComponentId: stringValue(expression.openingElement, "baseComponentId"),
    baseComponentVersion: numberValue(expression.openingElement, "baseComponentVersion", 1),
    component: {
      name,
      description: stringValue(definition.openingElement, "description", `AI-generated component ${name}.`),
      code,
      propsSchema: normalizePropsSchema(schema),
    },
    source: candidate,
  };
}
