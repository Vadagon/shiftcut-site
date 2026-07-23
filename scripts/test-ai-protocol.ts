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
    { type: "create_track", temporaryId: "new:overlay", trackType: "visual", name: "Overlay", position: 0 },
    { type: "move_element", elementId: "title-1", trackId: "new:overlay", startTime: 1 },
    { type: "update_element", elementId: "title-1", patch: { duration: 5, params: { text: "New" } } },
    { type: "update_element", elementId: "video-1", patch: { duration: 6 } },
    { type: "delete_track", trackId: "v-empty" },
    { type: "edit_component", elementId: "title-1", instruction: "Make it explode at 3 seconds" },
  ],
}), 7);

if (transaction.type !== "editor_transaction") throw new Error("Transaction was not parsed.");
const simulation = simulateTransaction({ transaction, tracks, assets: [{ id: "media-1", name: "Video", kind: "video", mime: "video/mp4", size: 1, duration: 8, createdAt: 0 }], fps: 30 });
const title = simulation.tracks.flatMap((track) => track.elements).find((element) => element.id === "title-1");
if (!title || title.startTime !== 1 || title.duration !== 5 || title.params.text !== "New") throw new Error("Compound transaction simulation failed.");
if (simulation.tracks.some((track) => track.id === "v-empty")) throw new Error("Empty track was not deleted.");
if (simulation.componentJobs.length !== 1 || simulation.componentJobs[0].elementId !== "title-1") throw new Error("Component job was not staged.");

let overlapRejected = false;
try {
  const invalid = parseEditorTransaction(JSON.stringify({
    type: "editor_transaction", expectedRevision: 7, summary: "Bad", reply: "Bad",
    operations: [{ type: "move_element", elementId: "title-1", trackId: "v1", startTime: 1 }],
  }), 7);
  if (invalid.type === "editor_transaction") simulateTransaction({ transaction: invalid, tracks, assets: [], fps: 30 });
} catch {
  overlapRejected = true;
}
if (!overlapRejected) throw new Error("Overlapping transaction was accepted.");

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
  overlap: "rejected",
  focusedComponent: "accepted",
}));
