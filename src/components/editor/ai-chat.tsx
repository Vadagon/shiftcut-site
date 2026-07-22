"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { useMediaStore } from "@/stores/media-store";
import { usePanelStore } from "@/stores/panel-store";
import { useComponentStore } from "@/stores/component-store";
import { storageService } from "@/lib/storage/storage-service";
import { uid } from "@/lib/utils";
import { elementEnd, type ElementParams, type TimelineElement, type TimelineTrack, type TrackType } from "@/types/timeline";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  body: string;
  tools?: string;
  artifact?: Record<string, unknown>;
  status?: "pending" | "failed" | "complete";
  error?: string;
};

type TimelineOperation = Record<string, unknown> & { action?: string };
type ChatResponse = {
  reply?: string;
  content?: string;
  expectedRevision?: number | null;
  operations?: TimelineOperation[];
  error?: string;
};

export function AiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const project = useProjectStore((state) => state.activeProject);
  const tracks = useTimelineStore((state) => state.tracks);
  const selectedElementId = useTimelineStore((state) => state.selectedElementId);
  const pool = useMediaStore((state) => state.pool);
  const components = useComponentStore((state) => state.components);

  useEffect(() => {
    let cancelled = false;
    if (!project?.id) {
      queueMicrotask(() => {
        if (!cancelled) { setMessages([]); setConversation([]); }
      });
      return;
    }
    queueMicrotask(() => {
      if (!cancelled) { setMessages([]); setConversation([]); }
    });
    void storageService.loadChatHistory(project.id).then((history) => {
      if (cancelled || !history) return;
      setMessages(history.messages.map((message) => ({ id: message.id ?? uid("msg"), role: message.role, body: message.content, tools: message.tools, artifact: message.artifact, status: message.status, error: message.error })));
      setConversation(history.messages.map((message) => ({ role: message.role, content: message.content })));
    });
    return () => { cancelled = true; };
  }, [project?.id]);

  const saveMessages = (next: ChatMessage[]) => {
    if (project?.id) void storageService.saveChatHistory(project.id, next.map((item) => ({ id: item.id, role: item.role, content: item.body, tools: item.tools, artifact: item.artifact, status: item.status, error: item.error })));
  };

  const appendMessage = (message: ChatMessage) => {
    setMessages((current) => {
      const next = [...current, message].slice(-200);
      saveMessages(next);
      return next;
    });
  };

  const updateMessage = (id: string, patch: Partial<ChatMessage>) => {
    setMessages((current) => {
      const next = current.map((message) => message.id === id ? { ...message, ...patch } : message);
      saveMessages(next);
      return next;
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, isSending]);

  const sendRequest = async (value: string, requestId?: string) => {
    if (!value || isSending) return;
    const animationRequested = /\b(?:animate|animation|explode|explosion|burst|particle|motion|bounce|slide|zoom|transition)\b/i.test(value);
    const restructureRequested = /\b(?:restructure|resturcture|reorganize|reorganise|clean up|cleanup|compact)\b.*\b(?:timeline|tracks?)\b|\b(?:timeline|tracks?)\b.*\b(?:restructure|resturcture|reorganize|reorganise|clean up|cleanup|compact)\b/i.test(value);
    const requestSnapshot = project ? projectSnapshot(project, tracks, pool, components, selectedElementId) : undefined;
    const messageId = requestId ?? uid("msg");
    const nextConversation = requestId ? conversation : [...conversation, { role: "user" as const, content: value }];
    if (requestId) updateMessage(requestId, { status: "pending", error: undefined });
    else {
      appendMessage({ id: messageId, role: "user", body: value, status: "pending" });
      setConversation(nextConversation);
    }
    setDraft("");
    setIsSending(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextConversation,
          project: requestSnapshot,
        }),
      });
      const result = await response.json() as ChatResponse;
      const reply = result.reply ?? result.content;
      if (!response.ok || !reply) throw new Error(result.error ?? "AI response failed.");
      const currentRevision = useProjectStore.getState().activeProject?.revision;
      const applied = currentRevision !== undefined && result.expectedRevision === currentRevision
        ? applyOperations(result.operations ?? [], animationRequested, restructureRequested)
        : [];
      if (applied.length) repairTimelineOverlaps();
      updateMessage(messageId, { status: "complete", error: undefined });
      appendMessage({ id: uid("msg"), role: "assistant", body: reply, tools: applied.length ? `Applied: ${applied.join(", ")}` : undefined, artifact: {
        request: requestSnapshot,
        response: { operations: result.operations ?? [], applied, timelineAfter: timelineContext(useTimelineStore.getState().tracks, useComponentStore.getState().components, true) },
      } });
      setConversation((current) => [...current, { role: "assistant", content: reply }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI response failed.";
      updateMessage(messageId, { status: "failed", error: message });
    } finally {
      setIsSending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void sendRequest(draft.trim());
  };

  return (
    <aside className="relative flex h-full min-h-0 flex-col bg-[#edebe8] text-[#302e2b]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#c9c7c2] px-4 text-[12px] font-semibold tracking-[0.02em]">
        <span>AI</span>
        <button type="button" title="Request history" aria-label="Request history" onClick={() => setHistoryOpen((open) => !open)} className="flex h-7 w-7 items-center justify-center text-[16px] font-normal text-[#69655f] hover:bg-[#e2dfdb] hover:text-[#292724]">▤</button>
      </div>
      {historyOpen && <HistoryDrawer messages={messages} onClose={() => setHistoryOpen(false)} />}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div className="space-y-6">
          {messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "flex justify-end" : "max-w-full"}>
              <div className={message.role === "user" ? "max-w-[88%] rounded-[3px] bg-[#e1dfdc] px-3 py-2 text-[13px] leading-5 text-[#292724]" : "text-[15px] leading-[1.55] text-[#252320]"}>
                {message.tools && <div className="mb-2 flex items-center gap-2 text-[12px] text-[#807d78]"><span className="h-2 w-2 rounded-full bg-[#438d58]" />{message.tools}</div>}
                <MessageText content={message.body} />
                {message.role === "user" && message.status !== "complete" && <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#c9c7c2] pt-2 text-[10px] text-[#77726c]">
                  <span>{message.status === "failed" ? "No response" : isSending ? "Waiting for response" : "No response yet"}</span>
                  <button type="button" disabled={isSending} onClick={() => void sendRequest(message.body, message.id)} className="font-semibold text-[#57524c] underline underline-offset-2 hover:text-[#292724] disabled:opacity-50">Retry</button>
                </div>}
              </div>
            </div>
          ))}
          {isSending && <ThinkingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="shrink-0 px-5 pb-4 pt-2">
        <div className="mb-2 text-[10px] text-[#827d76]">Project revision {project?.revision ?? "—"} · synced automatically</div>
        <form onSubmit={submit} className="relative rounded-[5px] border border-[#c9c7c2] bg-[#f8f7f5] p-3 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
          <span title="Coming soon: connect Codex, Claude, or Gemini through MCP. Free to use with your own AI connection." className="absolute right-3 top-3 inline-flex items-center gap-1.5 py-1 text-[10px] font-semibold text-[#aaa69f]"><i className="h-1.5 w-1.5 rounded-full bg-[#aaa69f]" />MCP · soon</span>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }} rows={2} placeholder="Tell AI what changes to make — @ to reference media" className="block w-full resize-none border-0 bg-transparent pr-24 text-[13px] leading-5 text-[#373430] outline-none placeholder:text-[#98948d]" />
          <div className="mt-3 flex justify-end text-[12px] text-[#69655f]">
            <button disabled={isSending || !draft.trim()} type="submit" aria-label="Send" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1b295] text-white shadow-sm hover:bg-[#e79b78] disabled:cursor-not-allowed disabled:opacity-50">{isSending ? "…" : "↑"}</button>
          </div>
        </form>
      </div>
    </aside>
  );
}

function MessageText({ content }: { content: string }) {
  return (
    <p className="whitespace-pre-wrap">
      {content.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**")
        ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>
        : part)}
    </p>
  );
}

function ThinkingIndicator() {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-[13px] text-[#77726c]">
      <span>Thinking</span>
      <span className="flex gap-1" aria-hidden="true"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8a857e] [animation-delay:-0.2s]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8a857e] [animation-delay:-0.1s]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8a857e]" /></span>
    </div>
  );
}

function HistoryDrawer({ messages, onClose }: { messages: ChatMessage[]; onClose: () => void }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      setCopiedKey(null);
    }
  };
  const copyExchange = async (index: number) => {
    const response = messages[index];
    let request = "";
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (messages[cursor].role === "user") { request = messages[cursor].body; break; }
    }
    const artifact = response.artifact ? `\n\n# ShiftCut structured artifact\n${JSON.stringify(response.artifact, null, 2)}` : "";
    await copy(`exchange-${index}`, `# ShiftCut AI request\n${request}\n\n# ShiftCut AI response\n${response.body}${artifact}`);
  };
  return (
    <div className="absolute inset-x-0 top-10 z-40 flex max-h-[70%] flex-col border-b border-[#aaa69f] bg-[#efeeeb] shadow-[0_8px_16px_rgba(0,0,0,.12)]">
      <div className="flex items-center justify-between border-b border-[#d5d2cc] px-4 py-3">
        <div><div className="text-[13px] font-semibold text-[#292724]">Request history</div><p className="mt-0.5 text-[10px] text-[#77726c]">Saved with this project</p></div>
        <button type="button" onClick={onClose} aria-label="Close request history" className="h-6 w-6 text-[15px] text-[#69655f] hover:text-[#292724]">×</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {messages.length === 0 ? <p className="px-2 py-8 text-center text-[12px] text-[#77726c]">No AI requests yet.</p> : (
          <div className="space-y-3">
            {[...messages].map((message, index) => ({ message, index })).filter(({ message }) => message.role === "assistant").reverse().map(({ message, index }) => (
              <article key={index} className="border border-[#d5d2cc] bg-[#f7f6f4] p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[#89857e]">Request</div>
                <p className="line-clamp-3 text-[11px] leading-4 text-[#49453f]">{previousRequest(messages, index)}</p>
                <div className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-[.08em] text-[#89857e]">Response</div>
                <p className="line-clamp-5 whitespace-pre-wrap text-[11px] leading-4 text-[#49453f]">{message.body}</p>
                <button type="button" onClick={() => void copyExchange(index)} className="mt-3 border border-[#c9c7c2] bg-[#efeeeb] px-2 py-1 text-[10px] font-medium text-[#56514c] hover:border-[#77736d]">{copiedKey === `exchange-${index}` ? "Copied" : "Copy complete exchange"}</button>
                <HistoryArtifact artifact={message.artifact} index={index} copiedKey={copiedKey} onCopy={copy} />
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryArtifact({ artifact, index, copiedKey, onCopy }: { artifact?: Record<string, unknown>; index: number; copiedKey: string | null; onCopy: (key: string, text: string) => Promise<void> }) {
  if (!artifact) return <p className="mt-3 text-[10px] leading-4 text-[#89857e]">Structured component and timeline details are available for new requests.</p>;
  const response = asRecord(artifact.response);
  const operations = Array.isArray(response?.operations) ? response.operations.map(asRecord).filter(Boolean) as Record<string, unknown>[] : [];
  const components = operations.flatMap((operation) => {
    const component = asRecord(operation.component);
    const code = typeof component?.code === "string" ? component.code : null;
    return code ? [{ name: typeof component?.name === "string" ? component.name : "GeneratedComponent", description: typeof component?.description === "string" ? component.description : "", code }] : [];
  });
  return (
    <div className="mt-3 space-y-2 border-t border-[#d5d2cc] pt-3">
      {components.length > 0 && <details>
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[.08em] text-[#6e6963]">Returned components ({components.length})</summary>
        <div className="mt-2 space-y-2">
          {components.map((component, componentIndex) => <div key={componentIndex} className="border border-[#c9c7c2] bg-[#292724] p-2">
            <div className="mb-1 flex items-center justify-between gap-2"><span className="truncate text-[10px] font-semibold text-[#ece9e4]">{component.name}</span><button type="button" onClick={() => void onCopy(`component-${index}-${componentIndex}`, component.code)} className="border border-white/25 px-1.5 py-0.5 text-[9px] text-white hover:bg-white/10">{copiedKey === `component-${index}-${componentIndex}` ? "Copied" : "Copy code"}</button></div>
            {component.description && <p className="mb-1 text-[9px] leading-3 text-[#c5c1bb]">{component.description}</p>}
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap text-[9px] leading-3 text-[#ece9e4]"><code>{component.code}</code></pre>
          </div>)}
        </div>
      </details>}
      <details>
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[.08em] text-[#6e6963]">Timeline and project snapshot</summary>
        <div className="mt-2">
          <button type="button" onClick={() => void onCopy(`snapshot-${index}`, JSON.stringify(artifact, null, 2))} className="mb-2 border border-[#c9c7c2] bg-[#efeeeb] px-2 py-1 text-[10px] font-medium text-[#56514c] hover:border-[#77736d]">{copiedKey === `snapshot-${index}` ? "Copied" : "Copy snapshot"}</button>
          <pre className="max-h-52 overflow-auto border border-[#c9c7c2] bg-[#efeeeb] p-2 text-[9px] leading-3 text-[#49453f]"><code>{JSON.stringify(artifact, null, 2)}</code></pre>
        </div>
      </details>
    </div>
  );
}

function previousRequest(messages: ChatMessage[], index: number) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) if (messages[cursor].role === "user") return messages[cursor].body;
  return "No preceding request.";
}

function projectSnapshot(project: NonNullable<ReturnType<typeof useProjectStore.getState>["activeProject"]>, tracks: TimelineTrack[], pool: ReturnType<typeof useMediaStore.getState>["pool"], components: ReturnType<typeof useComponentStore.getState>["components"], selectedElementId: string | null) {
  // A click in the timeline is always the explicit target. When the user has
  // not clicked one, give the assistant a deterministic fallback instead of
  // making a vague animation request target an arbitrary layer.
  const generatedElements = tracks.flatMap((track) => track.elements.filter((element) => Boolean(element.componentId)));
  const suggestedElementId = selectedElementId ?? (generatedElements.length === 1 ? generatedElements[0].id : null);
  const currentComponentIds = new Set(tracks.flatMap((track) => track.elements.flatMap((element) => element.componentId ? [element.componentId] : [])));
  return {
    name: project.name,
    revision: project.revision,
    settings: project.settings,
    selectedElementId,
    suggestedElementId,
    timeline: timelineContext(tracks, components),
    // Send only artifacts referenced by the visible current revision. The
    // registry retains old versions for undo, but they must not confuse the AI
    // after a user restores an earlier timeline state.
    components: Object.values(components).filter((component) => currentComponentIds.has(component.id)).map((component) => ({ id: component.id, version: component.version, name: component.name, description: component.description, code: component.code, propsSchema: component.propsSchema })),
    assets: pool.map((asset) => ({ id: asset.id, name: asset.name, kind: asset.kind, duration: asset.duration, width: asset.width, height: asset.height })),
  };
}

function timelineContext(tracks: TimelineTrack[], components: ReturnType<typeof useComponentStore.getState>["components"], includeCode = false) {
  return tracks.map((track) => ({
    id: track.id,
    name: track.name,
    type: track.type,
    elements: track.elements.map((element) => ({
      id: element.id,
      name: element.name,
      component: element.component,
      componentId: element.componentId,
      componentVersion: element.componentVersion,
      componentName: element.componentId ? components[element.componentId]?.name : undefined,
      componentDescription: element.componentId ? components[element.componentId]?.description : undefined,
      hasComponentCode: Boolean(element.componentId),
      ...(includeCode && element.componentId ? { componentCode: components[element.componentId]?.code, componentPropsSchema: components[element.componentId]?.propsSchema } : {}),
      mediaId: element.mediaId,
      startTime: element.startTime,
      duration: element.duration,
      trimStart: element.trimStart,
      trimEnd: element.trimEnd,
      params: element.params,
    })),
  }));
}

function applyOperations(operations: TimelineOperation[], requireTimelineTime = false, removeEmptyTracks = false) {
  const store = useTimelineStore.getState();
  const pool = useMediaStore.getState().pool;
  const applied: string[] = [];
  for (const operation of operations.slice(0, 12)) {
    if (!operation || typeof operation.action !== "string") continue;
    if (operation.action === "replace_timeline") {
      const replacement = replacementTimeline(operation.tracks, pool, requireTimelineTime);
      if (!replacement) continue;
      store.replaceTimeline(replacement);
      applied.push("entire timeline");
      break;
    }
    if (operation.action === "add_component") {
      const component = asRecord(operation.component);
      const code = typeof component?.code === "string" ? component.code : "";
      if (!isSafeComponentCode(code, requireTimelineTime)) continue;
      const startTime = nonNegative(operation.startTime);
      const duration = Math.max(0.1, finite(operation.duration, 3));
      const trackId = placementTrack("media", operation.trackId, startTime, duration);
      const params = componentParams(operation.params);
      const name = stringValue(operation.name, "AI overlay");
      const artifact = useComponentStore.getState().upsert({ name: stringValue(component?.name, "GeneratedComponent"), description: stringValue(component?.description, "AI-generated overlay"), code, propsSchema: componentSchema(component?.propsSchema) });
      const id = store.addElementToTrack(trackId, {
        type: "text", name, component: "GeneratedReactComponent",
        componentId: artifact.id,
        componentVersion: artifact.version,
        startTime, duration, trimStart: 0, trimEnd: 0,
        params: { ...defaultParams(), ...params },
      });
      store.selectElement(id);
      usePanelStore.getState().setActive("inspector");
      applied.push("React overlay");
    }
    if (operation.action === "update_params") {
      const elementId = typeof operation.elementId === "string" ? operation.elementId : "";
      if (!store.findElement(elementId)) continue;
      store.updateElementParams(elementId, componentParams(operation.params));
      store.selectElement(elementId);
      usePanelStore.getState().setActive("inspector");
      applied.push("properties");
    }
    if (operation.action === "update_component") {
      const elementId = typeof operation.elementId === "string" ? operation.elementId : "";
      const found = store.findElement(elementId);
      const component = asRecord(operation.component);
      const code = typeof component?.code === "string" ? component.code : "";
      if (!found || !isSafeComponentCode(code, requireTimelineTime)) continue;
      const existing = found.element.componentId ? useComponentStore.getState().get(found.element.componentId) : undefined;
      const artifact = useComponentStore.getState().upsert({ name: stringValue(component?.name, existing?.name ?? "GeneratedComponent"), description: stringValue(component?.description, existing?.description ?? "AI-generated overlay"), code, propsSchema: componentSchema(component?.propsSchema) }, found.element.componentId);
      store.updateElementComponent(elementId, { componentId: artifact.id, componentVersion: artifact.version });
      store.selectElement(elementId);
      usePanelStore.getState().setActive("inspector");
      applied.push("React component");
    }
    if (operation.action === "move_element") {
      const elementId = typeof operation.elementId === "string" ? operation.elementId : "";
      const found = store.findElement(elementId);
      if (!found) continue;
      const startTime = nonNegative(operation.startTime);
      const duration = elementEnd(found.element) - found.element.startTime;
      const trackId = placementTrack(found.track.type, operation.trackId, startTime, duration, elementId);
      if (trackId === found.track.id) store.updateElementStartTime(elementId, startTime);
      else store.moveElementToTrack(elementId, trackId, startTime);
      store.selectElement(elementId);
      usePanelStore.getState().setActive("inspector");
      applied.push("timeline position");
    }
    if (operation.action === "remove_element") {
      const elementId = typeof operation.elementId === "string" ? operation.elementId : "";
      if (!store.findElement(elementId)) continue;
      store.removeElement(elementId);
      applied.push("timeline element");
    }
    if (operation.action === "add_media") {
      const mediaId = typeof operation.mediaId === "string" ? operation.mediaId : "";
      const media = pool.find((asset) => asset.id === mediaId);
      if (!media) continue;
      const component = media.kind === "video" ? "VideoPlayer" : media.kind === "audio" ? "AudioPlayer" : "ImagePlayer";
      const startTime = nonNegative(operation.startTime);
      const duration = Math.max(0.1, media.duration ?? 5);
      const trackId = placementTrack(media.kind === "audio" ? "audio" : "media", operation.trackId, startTime, duration);
      const id = store.addElementToTrack(trackId, {
        type: "media", mediaId, name: media.name, component,
        startTime, duration, trimStart: 0, trimEnd: 0,
        params: defaultParams(),
      });
      store.selectElement(id);
      usePanelStore.getState().setActive("inspector");
      applied.push("media asset");
    }
  }
  // This cleanup is deliberately limited to an accepted AI restructuring
  // request. Normal loading and ordinary edits never remove empty tracks.
  if (removeEmptyTracks && applied.length > 0 && store.tracks.some((track) => track.elements.length === 0)) {
    store.removeEmptyTracks();
    applied.push("empty tracks");
  }
  return [...new Set(applied)];
}

function replacementTimeline(value: unknown, pool: ReturnType<typeof useMediaStore.getState>["pool"], requireTimelineTime: boolean): TimelineTrack[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 32) return null;
  const tracks: TimelineTrack[] = [];
  for (const rawTrack of value) {
    const track = asRecord(rawTrack);
    const type: TrackType = track?.type === "audio" ? "audio" : "media";
    const rawElements = Array.isArray(track?.elements) ? track.elements : [];
    const elements: TimelineElement[] = [];
    for (const rawElement of rawElements) {
      const item = asRecord(rawElement);
      if (!item) continue;
      const startTime = nonNegative(item.startTime);
      const duration = Math.max(0.1, finite(item.duration, 3));
      const generated = asRecord(item.generatedComponent);
      if (generated) {
        const code = typeof generated.code === "string" ? generated.code : "";
        if (!isSafeComponentCode(code, requireTimelineTime) || type !== "media") continue;
        const artifact = useComponentStore.getState().upsert({ name: stringValue(generated.name, "GeneratedComponent"), description: stringValue(generated.description, "AI-generated overlay"), code, propsSchema: componentSchema(generated.propsSchema) });
        elements.push({ id: uid("el"), type: "text", name: stringValue(item.name, artifact.name), component: "GeneratedReactComponent", componentId: artifact.id, componentVersion: artifact.version, startTime, duration, trimStart: 0, trimEnd: 0, params: { ...defaultParams(), ...componentParams(item.params) } });
        continue;
      }
      const mediaId = typeof item.mediaId === "string" ? item.mediaId : "";
      const media = pool.find((asset) => asset.id === mediaId);
      if (!media || (type === "audio") !== (media.kind === "audio")) continue;
      const component = media.kind === "audio" ? "AudioPlayer" : media.kind === "video" ? "VideoPlayer" : "ImagePlayer";
      elements.push({ id: uid("el"), type: "media", mediaId, name: stringValue(item.name, media.name), component, startTime, duration: Math.min(duration, media.duration ?? duration), trimStart: 0, trimEnd: 0, params: { ...defaultParams(), ...componentParams(item.params) } });
    }
    const ordered = [...elements].sort((a, b) => a.startTime - b.startTime);
    if (ordered.some((element, index) => index > 0 && element.startTime < elementEnd(ordered[index - 1]))) return null;
    tracks.push({ id: uid("track"), name: stringValue(track?.name, type === "audio" ? "Audio" : "Video"), type, elements: ordered, muted: false, hidden: false, locked: false });
  }
  return tracks;
}

function placementTrack(type: TrackType, requestedTrackId: unknown, startTime: number, duration: number, exceptElementId?: string) {
  const store = useTimelineStore.getState();
  const fits = (track: TimelineTrack) => track.type === type && !track.elements.some((element) => element.id !== exceptElementId && startTime < elementEnd(element) && startTime + duration > element.startTime);
  const requested = typeof requestedTrackId === "string" ? store.tracks.find((track) => track.id === requestedTrackId) : undefined;
  if (requested && fits(requested)) return requested.id;
  const openTrack = store.tracks.find(fits);
  return openTrack?.id ?? store.addTrack(type);
}

function repairTimelineOverlaps() {
  const store = useTimelineStore.getState();
  for (const track of store.tracks) {
    let occupiedUntil = -Infinity;
    const elements = [...track.elements].sort((a, b) => a.startTime - b.startTime);
    for (const element of elements) {
      const duration = elementEnd(element) - element.startTime;
      if (element.startTime < occupiedUntil) {
        const targetTrackId = placementTrack(track.type, undefined, element.startTime, duration, element.id);
        store.moveElementToTrack(element.id, targetTrackId, element.startTime);
      } else {
        occupiedUntil = elementEnd(element);
      }
    }
  }
}

function asRecord(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function finite(value: unknown, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function nonNegative(value: unknown) { return Math.max(0, finite(value, 0)); }
function stringValue(value: unknown, fallback: string) { return typeof value === "string" && value.trim() ? value.slice(0, 120) : fallback; }
function defaultParams(): ElementParams { return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, zIndex: 1, volume: 1 }; }

function componentParams(value: unknown): Partial<ElementParams> {
  const allowed = new Set(["x", "y", "scale", "scaleX", "scaleY", "rotation", "opacity", "zIndex", "filter", "text", "color", "fontSize", "volume"]);
  const record = asRecord(value);
  if (!record) return {};
  return Object.fromEntries(Object.entries(record).filter(([key, item]) => allowed.has(key) && (typeof item === "string" || typeof item === "number" || typeof item === "boolean"))) as Partial<ElementParams>;
}

function componentSchema(value: unknown): Array<{ name: string; type: "string" | "number" | "boolean" | "color"; default?: unknown }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((item) => {
    const record = asRecord(item);
    const name = typeof record?.name === "string" ? record.name.slice(0, 60) : "";
    const type = record?.type;
    return name && (type === "string" || type === "number" || type === "boolean" || type === "color") ? [{ name, type, default: record?.default }] : [];
  });
}

function isSafeComponentCode(code: string, requireTimelineTime = false) {
  const timeDriven = !requireTimelineTime || /props\.localTime\b/.test(code);
  return timeDriven && code.length > 0 && code.length <= 16_000 && /function\s+GeneratedComponent\s*\(/.test(code) && !/\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document|window|setTimeout|setInterval|requestAnimationFrame|import|eval|Function|Date|performance|transition|animation)\b|Math\.random/.test(code);
}
