import { serializeCompactProject } from "../src/lib/composition-dsl";
import { acceptComponentStage, acceptTimelineStage } from "../src/lib/ai-composition-protocol";

const code = "function GeneratedComponent(props) { return React.createElement('div', null, props.text); }";
const compactProject = serializeCompactProject({
  project: { name: "Test", revision: 9, settings: { width: 1080, height: 1920, fps: 30, background: "#000000" } },
  assets: [],
  components: {
    c1: { id: "c1", projectId: "project", version: 2, name: "Title", description: "Title", code, propsSchema: [{ name: "text", type: "string" }], createdAt: 0, updatedAt: 0 },
  },
  tracks: [{
    id: "v1", name: "V1", type: "media", muted: false, hidden: false, locked: false,
    elements: [{
      id: "e1", type: "text", name: "Title", component: "GeneratedReactComponent", componentId: "c1", componentVersion: 2,
      startTime: 0, duration: 5, trimStart: 0, trimEnd: 0,
      params: { x: 540, y: 960, scale: 1, rotation: 0, opacity: 1, zIndex: 2, text: "Old" },
    }],
  }],
});

const timeline = acceptTimelineStage({
  compactProject,
  rawContent: `<TimelineEdit expectedRevision={9} reply={"Changed text"}>
    <VisualTrack id={"v1"} name={"V1"} muted={false} hidden={false} locked={false}>
      <Component elementId={"e1"} name={"Title"} componentId={"c1"} componentVersion={2} start={0} duration={5} trimStart={0} trimEnd={0} text={"New"} x={540} y={960} scale={1} rotation={0} opacity={1} zIndex={2} />
    </VisualTrack>
  </TimelineEdit>`,
});
if (timeline.type !== "timeline-edit" || (timeline.tracks[0].elements as Array<Record<string, unknown>>)[0].params === undefined) throw new Error("TimelineEdit failed.");

const request = acceptTimelineStage({
  compactProject,
  rawContent: `<RequestComponent expectedRevision={9} reply={"Loading"} elementId={"e1"} componentId={"c1"} componentVersion={2} />`,
});
if (request.type !== "request-component") throw new Error("RequestComponent failed.");

let duplicateRejected = false;
try {
  acceptTimelineStage({
    compactProject,
    userRequest: "Make the title animation more epic",
    suggestedElementId: "e1",
    rawContent: `<RequestComponent expectedRevision={9} reply={"Create duplicate"} elementId={"new:title"} componentId={"new:title"} componentVersion={1} trackId={"v1"} start={0} duration={5} />`,
  });
} catch {
  duplicateRejected = true;
}
if (!duplicateRejected) throw new Error("Existing target continuity failed.");

let animationTimelineRejected = false;
try {
  acceptTimelineStage({
    compactProject,
    userRequest: "Make the explosion more epic",
    requireComponentEdit: true,
    rawContent: `<TimelineEdit expectedRevision={9} reply={"Done"}>
      <VisualTrack id={"v1"} name={"V1"} muted={false} hidden={false} locked={false}>
        <Component elementId={"e1"} name={"Title"} componentId={"c1"} componentVersion={2} start={0} duration={5} trimStart={0} trimEnd={0} text={"Old"} x={540} y={960} scale={1} rotation={0} opacity={1} zIndex={2} />
      </VisualTrack>
    </TimelineEdit>`,
  });
} catch {
  animationTimelineRejected = true;
}
if (!animationTimelineRejected) throw new Error("Animation request incorrectly accepted a TimelineEdit.");

const component = acceptComponentStage({
  compactProject,
  request,
  requireAnimation: true,
  rawContent: `<ComponentEdit expectedRevision={9} targetElementId={"e1"} baseComponentId={"c1"} baseComponentVersion={2} reply={"Animated"}>
    <ComponentDefinition name={"Title"} description={"Animated title"} propsSchema={String.raw\`[{"name":"text","type":"string"}]\`} code={String.raw\`function GeneratedComponent(props) { const t = props.localTime; return React.createElement('div', {style:{opacity:t}}, props.text); }\`} />
  </ComponentEdit>`,
});
if (component.type !== "component-edit") throw new Error("ComponentEdit failed.");

const newRequest = acceptTimelineStage({
  compactProject,
  rawContent: `<RequestComponent expectedRevision={9} reply={"Create"} elementId={"new:boom"} componentId={"new:boom"} componentVersion={1} trackId={"v1"} name={"Boom"} start={5} duration={4} text={"Boom"} x={540} y={960} />`,
});
if (newRequest.type !== "request-component" || newRequest.params.text !== "Boom") throw new Error("New RequestComponent failed.");
if (compactProject.includes(code)) throw new Error("Compact project leaked component source.");

console.log(JSON.stringify({ compactProject: "no component code", timelineEdit: "accepted", componentRequest: "accepted", existingTargetContinuity: "duplicate rejected", animationTimelineFallback: "rejected", componentEdit: "accepted", newComponentRequest: "accepted" }));
