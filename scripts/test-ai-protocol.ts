import { parseComponentResult, parseEditorTransaction, simulateTransaction } from "../src/lib/ai-transaction-protocol";
import type { TimelineTrack } from "../src/types/timeline";

const tracks: TimelineTrack[] = [
  {
    id: "v1", name: "Video", type: "media", muted: false, hidden: false, locked: false,
    elements: [
      { id: "video-1", type: "media", mediaId: "media-1", name: "Video", component: "VideoPlayer", startTime: 0, duration: 8, trimStart: 0, trimEnd: 0, params: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, zIndex: 1, volume: 1 } },
    ],
  },
  {
    id: "v-empty", name: "Empty", type: "media", muted: false, hidden: false, locked: false, elements: [],
  },
  {
    id: "v-title", name: "Title", type: "media", muted: false, hidden: false, locked: false,
    elements: [
      { id: "title-1", type: "text", name: "Title", component: "GeneratedReactComponent", componentId: "cmp-1", componentVersion: 2, startTime: 0, duration: 4, trimStart: 0, trimEnd: 0, params: { x: 540, y: 960, scale: 1, rotation: 0, opacity: 1, zIndex: 5, text: "Old" } },
    ],
  },
];

const transaction = parseEditorTransaction(JSON.stringify({
  type: "editor_transaction",
  expectedRevision: 7,
  summary: "Restructured opening",
  reply: "Done",
  operations: [
    { type: "update_project_settings", patch: { width: 1080, height: 1920, fps: 30 } },
    { type: "create_track", temporaryId: "new:overlay", trackType: "visual", name: "Overlay", position: 0 },
    { type: "move_element", elementId: "title-1", trackId: "new:overlay", startTime: 1 },
    { type: "update_element", elementId: "title-1", patch: { duration: 5, params: { text: "New" } } },
    { type: "update_element", elementId: "video-1", patch: { duration: 6, width: 1080, height: 1920 } },
    { type: "delete_track", trackId: "v-empty" },
    { type: "edit_component", elementId: "title-1", instruction: "Make it explode at 3 seconds" },
    { type: "create_component", temporaryElementId: "new:badge", trackId: "new:overlay", name: "Badge", startTime: 6, duration: 2, params: { text: "NEW" }, instruction: "Create an animated badge" },
    { type: "update_element", elementId: "new:badge", patch: { duration: 3 } },
  ],
}), 7);

if (transaction.type !== "editor_transaction") throw new Error("Transaction was not parsed.");
const simulation = simulateTransaction({ transaction, tracks, assets: [{ id: "media-1", name: "Video", kind: "video", mime: "video/mp4", size: 1, duration: 8, createdAt: 0 }], settings: { width: 1920, height: 1080, fps: 30 } });
const title = simulation.tracks.flatMap((track) => track.elements).find((element) => element.id === "title-1");
if (!title || title.startTime !== 1 || title.duration !== 5 || title.params.text !== "New") throw new Error("Compound transaction simulation failed.");
const video = simulation.tracks.flatMap((track) => track.elements).find((element) => element.id === "video-1");
if (!video || video.params.width !== 1080 || video.params.height !== 1920) throw new Error("Flat visual properties were not normalized into element params.");
if (simulation.tracks.some((track) => track.id === "v-empty")) throw new Error("Empty track was not deleted.");
if (simulation.componentJobs.length !== 2 || simulation.componentJobs[0].elementId !== "title-1") throw new Error("Component jobs were not staged.");
if (simulation.settings.width !== 1080 || simulation.settings.height !== 1920) throw new Error("Project settings were not staged.");
const badge = simulation.tracks.flatMap((track) => track.elements).find((element) => element.name === "Badge");
if (!badge || badge.duration !== 3) throw new Error("Temporary element ID was not resolved.");

const overlapPlan = parseEditorTransaction(JSON.stringify({
  type: "editor_transaction", expectedRevision: 7, summary: "Layered", reply: "Layered",
  operations: [{ type: "move_element", elementId: "title-1", trackId: "v1", startTime: 1 }],
}), 7);
if (overlapPlan.type !== "editor_transaction") throw new Error("Overlap plan failed.");
const expanded = simulateTransaction({ transaction: overlapPlan, tracks, assets: [], settings: { width: 1920, height: 1080, fps: 30 } });
if (expanded.tracks.length !== tracks.length + 1) throw new Error("Intentional overlap did not create an adjacent lane.");

const component = parseComponentResult(JSON.stringify({
  type: "component_result",
  expectedRevision: 7,
  elementId: "title-1",
  name: "Explosion",
  description: "Deterministic exploding title",
  propsSchema: [{ name: "text", type: "string", default: "Title" }],
  code: "function GeneratedComponent(props) { const t = props.localTime; return React.createElement('div', {style:{opacity:t}}, props.text); }",
  reply: "Updated explosion",
}), { expectedRevision: 7, elementId: "title-1", requireAnimation: true });
if (component.type !== "component_result") throw new Error("Component result failed.");

console.log(JSON.stringify({
  protocol: "JSON transaction",
  compoundOperations: "simulated atomically",
  temporaryTrackIds: "resolved",
  projectSettings: "staged atomically",
  flatElementProperties: "normalized into live params",
  overlap: "expanded into adjacent lane",
  focusedComponent: "accepted",
}));
