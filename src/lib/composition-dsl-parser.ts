import { parseExpression } from "@babel/parser";
import type { Expression, JSXAttribute, JSXElement, JSXExpressionContainer, JSXOpeningElement } from "@babel/types";
import { SHIFT_CUT_COMPOSITION_FORMAT } from "@/lib/composition-dsl";
import { validateGeneratedComponentSource } from "@/lib/generated-component-contract";

export type ParsedComponentDefinition = {
  id: string;
  version: number;
  name: string;
  description: string;
  code: string;
  propsSchema: unknown[];
};

export type ParsedCompositionResponse = {
  reply: string;
  expectedRevision: number | null;
  noChanges: boolean;
  compositionSource?: string;
  tracks?: Array<Record<string, unknown>>;
  componentDefinitions?: ParsedComponentDefinition[];
};

function tagName(element: JSXElement | JSXOpeningElement) {
  const name = "openingElement" in element ? element.openingElement.name : element.name;
  return name.type === "JSXIdentifier" ? name.name : "";
}

function children(element: JSXElement, name?: string) {
  return element.children.filter((child): child is JSXElement => child.type === "JSXElement" && (!name || tagName(child) === name));
}

function attribute(opening: JSXOpeningElement, name: string) {
  return opening.attributes.find((item): item is JSXAttribute => item.type === "JSXAttribute" && item.name.type === "JSXIdentifier" && item.name.name === name);
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
    // The serializer escapes template delimiters only so the transport stays
    // valid JSX. Restore those two sequences to the original source/JSON.
    return (expression.quasi.quasis[0]?.value.raw ?? "").replace(/\\`/g, "`").replace(/\\\$\{/g, "${");
  }
  throw new Error("Only literal JSX attributes and String.raw templates are allowed.");
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

function stringValue(opening: JSXOpeningElement, name: string) {
  const result = value(opening, name);
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
  const result = value(opening, name, false);
  return result === true;
}

function jsonValue(opening: JSXOpeningElement, name: string, fallback: unknown) {
  const result = value(opening, name, false);
  if (result === undefined) return fallback;
  if (typeof result !== "string") throw new Error(`${name} must use String.raw.`);
  try {
    return JSON.parse(result);
  } catch {
    throw new Error(`${name} is not valid JSON.`);
  }
}

function optionalString(opening: JSXOpeningElement, name: string, fallback: string) {
  const result = value(opening, name, false);
  return typeof result === "string" && result.trim() ? result : fallback;
}

function normalizePropsSchema(value: unknown) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("propsSchema must be an array or JSON Schema object.");
  const properties = (value as Record<string, unknown>).properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) throw new Error("propsSchema JSON Schema must contain properties.");
  return Object.entries(properties as Record<string, unknown>).map(([name, rawDefinition]) => {
    const definition = rawDefinition && typeof rawDefinition === "object" && !Array.isArray(rawDefinition) ? rawDefinition as Record<string, unknown> : {};
    const rawType = definition.type;
    const type = rawType === "boolean" || rawType === "number" || rawType === "color" ? rawType : "string";
    return { name, type, ...(definition.default !== undefined ? { default: definition.default } : {}) };
  });
}

function parseRoot(source: string) {
  const candidate = source.replace(/^```(?:jsx|tsx|javascript)?\s*/i, "").replace(/\s*```$/, "").trim();
  const expression = parseExpression(candidate, { plugins: ["jsx", "typescript"] });
  if (expression.type !== "JSXElement") throw new Error("Response must be one JSX element.");
  return { candidate, expression };
}

export function parseCompositionSource(source: string) {
  const { candidate, expression } = parseRoot(source);
  if (tagName(expression) !== "ShiftCutComposition") throw new Error("Root must be ShiftCutComposition.");
  if (value(expression.openingElement, "format") !== SHIFT_CUT_COMPOSITION_FORMAT) throw new Error(`Composition format must be ${SHIFT_CUT_COMPOSITION_FORMAT}.`);
  const project = children(expression, "Project")[0];
  const assetsRoot = children(expression, "Assets")[0];
  const definitionsRoot = children(expression, "ComponentDefinitions")[0];
  if (!project || !assetsRoot || !definitionsRoot) throw new Error("Composition requires Assets, Project, and ComponentDefinitions.");

  const assets = children(assetsRoot, "Asset").map((asset) => {
    const kind = stringValue(asset.openingElement, "kind");
    if (!["video", "image", "audio"].includes(kind)) throw new Error(`Unsupported asset kind ${kind}.`);
    return { id: stringValue(asset.openingElement, "id"), kind };
  });
  const assetKinds = new Map(assets.map((asset) => [asset.id, asset.kind]));

  const componentDefinitions = children(definitionsRoot, "ComponentDefinition").map((definition) => {
    const id = stringValue(definition.openingElement, "id");
    const code = stringValue(definition.openingElement, "code");
    const validation = validateGeneratedComponentSource(code);
    if (!validation.compatible) throw new Error(`Unsafe component ${id}: ${validation.errors.join(" ")}`);
    const propsSchema = normalizePropsSchema(jsonValue(definition.openingElement, "propsSchema", []));
    const fallbackName = id.startsWith("new:") ? id.slice(4) || "GeneratedComponent" : id;
    const name = optionalString(definition.openingElement, "name", fallbackName);
    return {
      id,
      version: numberValue(definition.openingElement, "version", 1),
      name,
      description: optionalString(definition.openingElement, "description", `AI-generated component ${name}.`),
      code,
      propsSchema,
    };
  });
  const definitionIds = new Set(componentDefinitions.map((definition) => definition.id));
  const tracks = children(project).map((track) => {
    const trackTag = tagName(track);
    if (trackTag !== "VisualTrack" && trackTag !== "AudioTrack") throw new Error(`Unsupported Project child ${trackTag}.`);
    const elements = children(track).map((element) => {
      const elementTag = tagName(element);
      if (!["Video", "Image", "Audio", "Text", "Component"].includes(elementTag)) throw new Error(`Unsupported timeline tag ${elementTag}.`);
      const componentId = value(element.openingElement, "componentId", false) ?? value(element.openingElement, "definitionId", false);
      const assetId = value(element.openingElement, "assetId", false);
      if (elementTag === "Component" && (typeof componentId !== "string" || !definitionIds.has(componentId))) throw new Error("Every Component must reference a supplied ComponentDefinition.");
      if (["Video", "Image", "Audio"].includes(elementTag) && typeof assetId !== "string") throw new Error(`${elementTag} requires assetId.`);
      if (typeof assetId === "string") {
        const requiredKind = elementTag.toLowerCase();
        if (assetKinds.get(assetId) !== requiredKind) throw new Error(`${elementTag} references a missing or incompatible Asset.`);
      }
      const params = jsonValue(element.openingElement, "params", {});
      if (!params || typeof params !== "object" || Array.isArray(params)) throw new Error("params must be a JSON object.");
      return {
        id: stringValue(element.openingElement, "id"),
        name: stringValue(element.openingElement, "name"),
        component: elementTag === "Component" ? "GeneratedReactComponent" : `${elementTag}Player`,
        ...(typeof componentId === "string" ? { componentId, componentVersion: numberValue(element.openingElement, "componentVersion", 1) } : {}),
        ...(typeof assetId === "string" ? { mediaId: assetId } : {}),
        startTime: numberValue(element.openingElement, "start"),
        duration: numberValue(element.openingElement, "duration"),
        trimStart: numberValue(element.openingElement, "trimStart", 0),
        trimEnd: numberValue(element.openingElement, "trimEnd", 0),
        params,
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
  return {
    source: candidate,
    revision: numberValue(expression.openingElement, "revision"),
    settings: {
      width: numberValue(project.openingElement, "width"),
      height: numberValue(project.openingElement, "height"),
      fps: numberValue(project.openingElement, "fps"),
      background: stringValue(project.openingElement, "background"),
    },
    assets,
    tracks,
    componentDefinitions,
  };
}

export function parseShiftCutResponse(source: string): ParsedCompositionResponse {
  const { candidate, expression } = parseRoot(source);
  if (tagName(expression) !== "ShiftCutResponse") throw new Error("Root must be ShiftCutResponse.");
  if (value(expression.openingElement, "format") !== "shiftcut-ai-jsx/v1") throw new Error("Response format must be shiftcut-ai-jsx/v1.");
  const reply = stringValue(expression.openingElement, "reply");
  const expectedRevision = numberValue(expression.openingElement, "expectedRevision");
  const noChanges = children(expression, "NoChanges").length > 0;
  const composition = children(expression, "ShiftCutComposition")[0];
  if (noChanges === Boolean(composition)) throw new Error("Response must contain exactly one of NoChanges or ShiftCutComposition.");
  if (noChanges) return { reply, expectedRevision, noChanges: true };
  const compositionSource = candidate.slice(composition.start ?? 0, composition.end ?? candidate.length);
  const parsed = parseCompositionSource(compositionSource);
  return { reply, expectedRevision, noChanges: false, compositionSource: parsed.source, tracks: parsed.tracks, componentDefinitions: parsed.componentDefinitions };
}
