"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { useMediaStore } from "@/stores/media-store";
import { usePanelStore } from "@/stores/panel-store";
import { useComponentStore } from "@/stores/component-store";
import { storageService } from "@/lib/storage/storage-service";
import type { ChatMemoryData } from "@/lib/storage/types";
import { uid } from "@/lib/utils";
import { elementEnd, type ElementParams, type TimelineElement, type TimelineTrack, type TrackType } from "@/types/timeline";
import { validateGeneratedComponentSource } from "@/lib/generated-component-contract";
import { serializeShiftCutComposition } from "@/lib/composition-dsl";
import { acceptShiftCutResponse, buildShiftCutSystemPrompt } from "@/lib/ai-composition-protocol";

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

const RECENT_RAW_MESSAGES = 8;
const COMPACT_AFTER_MESSAGES = 12;
const COMPACT_AFTER_CHARS = 16_000;
const MAX_RESPONSE_ATTEMPTS = 3;

function currentTimestamp() {
  return Date.now();
}

function modelMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.status !== "failed")
    .map((message) => ({ role: message.role, content: message.body }));
}

async function compactContext(projectId: string, messages: ChatMessage[], memory: ChatMemoryData | null) {
  const start = memory ? messages.findIndex((message) => message.id === memory.summarizedThroughMessageId) + 1 : 0;
  const unsummarized = messages.slice(Math.max(0, start));
  const chars = unsummarized.reduce((total, message) => total + message.body.length, 0);
  const needsCompaction = unsummarized.length > COMPACT_AFTER_MESSAGES || chars > COMPACT_AFTER_CHARS;
  if (!needsCompaction || unsummarized.length <= RECENT_RAW_MESSAGES) return { memory, messages: modelMessages(unsummarized), compactionTransport: null };

  const toCompact = unsummarized.slice(0, -RECENT_RAW_MESSAGES);
  const compactionRequestBody = { previousSummary: memory?.summary ?? "", messages: modelMessages(toCompact) };
  const compactionStartedAt = Date.now();
  const compacted = await fetch("/api/chat/compact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(compactionRequestBody),
  });
  const result = await compacted.json().catch(() => null) as { summary?: unknown } | null;
  const compactionTransport = {
    endpoint: "/api/chat/compact",
    method: "POST",
    requestHeaders: { "Content-Type": "application/json" },
    requestBody: compactionRequestBody,
    startedAt: compactionStartedAt,
    response: { status: compacted.status, statusText: compacted.statusText, headers: Object.fromEntries(compacted.headers.entries()), body: result, completedAt: Date.now() },
  };
  if (!compacted.ok || typeof result?.summary !== "string") return { memory, messages: modelMessages(unsummarized.slice(-RECENT_RAW_MESSAGES)), compactionTransport };
  const cursor = toCompact[toCompact.length - 1];
  const nextMemory: ChatMemoryData = { projectId, summary: result.summary, summarizedThroughMessageId: cursor.id, updatedAt: Date.now() };
  await storageService.saveChatMemory(projectId, nextMemory.summary, nextMemory.summarizedThroughMessageId);
  return { memory: nextMemory, messages: modelMessages(unsummarized.slice(-RECENT_RAW_MESSAGES)), compactionTransport };
}

export function AiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memory, setMemory] = useState<ChatMemoryData | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState<number | null>(null);
  const [requestPhase, setRequestPhase] = useState<"compacting" | "thinking" | "retrying">("thinking");
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
        if (!cancelled) { setMessages([]); setMemory(null); }
      });
      return;
    }
    queueMicrotask(() => {
      if (!cancelled) { setMessages([]); setMemory(null); }
    });
    void storageService.loadChatHistory(project.id).then((history) => {
      if (cancelled || !history) return;
      setMessages(history.messages.map((message) => ({ id: message.id ?? uid("msg"), role: message.role, body: message.content, tools: message.tools, artifact: message.artifact, status: message.status, error: message.error })));
    });
    void storageService.loadChatMemory(project.id).then((savedMemory) => { if (!cancelled) setMemory(savedMemory ?? null); });
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
  }, [messages, isSending, retryAttempt]);

  const sendRequest = async (value: string, requestId?: string) => {
    if (!value || isSending) return;
    const animationRequested = /\b(?:animate|animation|explode|explosion|burst|particle|motion|bounce|slide|zoom|transition)\b/i.test(value);
    const restructureRequested = /\b(?:restructure|resturcture|reorganize|reorganise|clean up|cleanup|compact)\b.*\b(?:timeline|tracks?)\b|\b(?:timeline|tracks?)\b.*\b(?:restructure|resturcture|reorganize|reorganise|clean up|cleanup|compact)\b/i.test(value);
    const requestSnapshot = project ? projectSnapshot(project, tracks, pool, components, selectedElementId) : undefined;
    const messageId = requestId ?? uid("msg");
    let transportArtifact: Record<string, unknown> = {
      endpoint: "/api/chat",
      method: "POST",
      requestHeaders: { "Content-Type": "application/json" },
      startedAt: currentTimestamp(),
      requestBody: null,
      response: null,
    };
    const pendingMessage: ChatMessage = { id: messageId, role: "user", body: value, status: "pending", artifact: { transport: transportArtifact } };
    const requestMessages = requestId
      ? messages.map((message) => message.id === messageId ? { ...message, status: "pending" as const, error: undefined } : message)
      : [...messages, pendingMessage];
    if (requestId) updateMessage(requestId, { status: "pending", error: undefined, artifact: { transport: transportArtifact } });
    else {
      appendMessage(pendingMessage);
    }
    setDraft("");
    setRetryAttempt(null);
    setRequestPhase("thinking");
    setIsSending(true);
    try {
      setRequestPhase("compacting");
      const context = project ? await compactContext(project.id, requestMessages, memory) : { memory, messages: modelMessages(requestMessages), compactionTransport: null };
      if (context.memory !== memory) setMemory(context.memory);
      setRequestPhase("thinking");
      if (!requestSnapshot) throw new Error("No active project composition is available.");
      const systemPrompt = buildShiftCutSystemPrompt({
        projectName: requestSnapshot.name,
        composition: requestSnapshot.composition,
        memory: context.memory?.summary ?? "",
        selectedElementId: requestSnapshot.selectedElementId,
        suggestedElementId: requestSnapshot.suggestedElementId,
        animationRequested,
      });
      const baseMessages = [{ role: "system" as const, content: systemPrompt }, ...context.messages];
      const attempts: Record<string, unknown>[] = [];
      let retryMessages = baseMessages;
      let result: ChatResponse | null = null;
      let lastAcceptanceError = "The model returned an empty response.";
      for (let attempt = 1; attempt <= MAX_RESPONSE_ATTEMPTS; attempt += 1) {
        if (attempt > 1) {
          setRetryAttempt(attempt);
          setRequestPhase("retrying");
        } else {
          setRequestPhase("thinking");
        }
        const requestBody = { messages: retryMessages };
        const attemptStartedAt = currentTimestamp();
        transportArtifact = {
          ...transportArtifact,
          requestBody: attempt === 1 ? requestBody : transportArtifact.requestBody,
          auxiliaryRequests: context.compactionTransport ? [context.compactionTransport] : [],
          response: { attempts: [...attempts], activeAttempt: attempt },
        };
        updateMessage(messageId, { artifact: { transport: transportArtifact } });
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const responseBody = await response.json().catch(() => null) as { content?: unknown; error?: unknown; upstream?: unknown } | null;
        const attemptRecord: Record<string, unknown> = {
          attempt,
          requestBody,
          startedAt: attemptStartedAt,
          response: {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseBody,
            completedAt: currentTimestamp(),
          },
        };
        attempts.push(attemptRecord);
        transportArtifact = { ...transportArtifact, response: { attempts: [...attempts], activeAttempt: null } };
        updateMessage(messageId, { artifact: { transport: transportArtifact } });
        if (!response.ok) {
          lastAcceptanceError = typeof responseBody?.error === "string" ? responseBody.error : "AI proxy request failed.";
          if (response.status >= 400 && response.status < 500) throw new Error(lastAcceptanceError);
        } else {
          const rawContent = typeof responseBody?.content === "string" ? responseBody.content : "";
          try {
            if (!rawContent.trim()) throw new Error("The model returned an empty response.");
            result = acceptShiftCutResponse({
              rawContent,
              currentCompositionSource: requestSnapshot.composition,
              animationRequested,
            });
            attemptRecord.acceptance = { passed: true };
            break;
          } catch (error) {
            lastAcceptanceError = error instanceof Error ? error.message : "The returned JSX failed client acceptance.";
            attemptRecord.acceptance = { passed: false, error: lastAcceptanceError };
            if (attempt < MAX_RESPONSE_ATTEMPTS) {
              retryMessages = [
                ...baseMessages,
                ...(rawContent ? [{ role: "assistant" as const, content: rawContent }] : []),
                { role: "user" as const, content: `Client acceptance test failed: ${lastAcceptanceError} Return the same intended result as one valid ShiftCutResponse JSX expression only.` },
              ];
            }
          }
        }
      }
      if (!result) throw new Error(`The AI returned an invalid composition after ${MAX_RESPONSE_ATTEMPTS} attempts. Acceptance test: ${lastAcceptanceError} Nothing was changed; retry the request.`);
      transportArtifact = { ...transportArtifact, response: { attempts: [...attempts], finalResult: result, completedAt: currentTimestamp() } };
      const reply = result.reply ?? result.content;
      if (!reply) throw new Error(result.error ?? "AI response failed.");
      const currentRevision = useProjectStore.getState().activeProject?.revision;
      const revisionMatches = currentRevision !== undefined && result.expectedRevision === currentRevision;
      const applied = revisionMatches
        ? applyOperations(result.operations ?? [], animationRequested, restructureRequested)
        : [];
      if (applied.length) repairTimelineOverlaps();
      if ((result.operations?.length ?? 0) > 0 && !applied.length) {
        throw new Error(revisionMatches
          ? "The AI edit payload could not be applied. Nothing was changed; retry the request."
          : "The project changed while AI was responding. Nothing was changed; retry with the current revision.");
      }
      const resultingTimeline = timelineContext(useTimelineStore.getState().tracks, useComponentStore.getState().components, true);
      updateMessage(messageId, { status: "complete", error: undefined, artifact: { transport: transportArtifact, editorResult: { receivedAtRevision: currentRevision ?? null, revisionMatches, applied, timelineAfter: resultingTimeline } } });
      appendMessage({ id: uid("msg"), role: "assistant", body: reply, tools: applied.length ? `Applied: ${applied.join(", ")}` : undefined, artifact: {
        transport: transportArtifact,
        request: requestSnapshot,
        response: { expectedRevision: result.expectedRevision ?? null, receivedAtRevision: currentRevision ?? null, revisionMatches, operations: result.operations ?? [], applied, timelineAfter: resultingTimeline },
      } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI response failed.";
      const priorResponse = asRecord(transportArtifact.response);
      transportArtifact = { ...transportArtifact, response: { ...priorResponse, error: message, completedAt: currentTimestamp() } };
      updateMessage(messageId, { status: "failed", error: message, artifact: { transport: transportArtifact } });
    } finally {
      setIsSending(false);
      setRetryAttempt(null);
      setRequestPhase("thinking");
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
                {message.role === "user" && message.status && message.status !== "complete" && <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#c9c7c2] pt-2 text-[10px] text-[#77726c]">
                  <span className={message.status === "failed" ? "text-[#b64132]" : undefined}>{message.status === "failed" ? `Failed: ${message.error ?? "No response"}` : requestPhase === "compacting" ? "Compressing older conversation" : requestPhase === "retrying" ? `Response check failed — retrying ${retryAttempt ?? 1}/3` : "Waiting for AI response"}</span>
                  <button type="button" disabled={isSending} onClick={() => void sendRequest(message.body, message.id)} className="font-semibold text-[#57524c] underline underline-offset-2 hover:text-[#292724] disabled:opacity-50">Retry</button>
                </div>}
              </div>
            </div>
          ))}
          {isSending && <ThinkingIndicator retryAttempt={retryAttempt} phase={requestPhase} />}
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

function ThinkingIndicator({ retryAttempt, phase }: { retryAttempt: number | null; phase: "compacting" | "thinking" | "retrying" }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-[13px] text-[#77726c]">
      <span>{phase === "compacting" ? "Compressing older conversation" : retryAttempt ? `Response check failed — retrying ${retryAttempt}/3` : "Thinking"}</span>
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
  const copyExchange = async (requestIndex: number, responseIndex?: number) => {
    const request = messages[requestIndex];
    const response = responseIndex === undefined ? undefined : messages[responseIndex];
    const status = request.status ?? (response ? "complete" : "unfinished");
    const transport = request.artifact?.transport ?? response?.artifact?.transport ?? null;
    const transportRecord = asRecord(transport);
    const transportResponse = asRecord(transportRecord?.response);
    const attempts = Array.isArray(transportResponse?.attempts) ? transportResponse.attempts : [];
    const activeProject = useProjectStore.getState().activeProject;
    const currentTracks = useTimelineStore.getState().tracks;
    const currentComponents = useComponentStore.getState().components;
    const currentAssets = useMediaStore.getState().pool;
    const fullPayload = {
      debugLogVersion: "shiftcut-debug/v2",
      exportedAt: new Date().toISOString(),
      runtime: {
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
        language: navigator.language,
        online: navigator.onLine,
      },
      selectedExchange: {
        request: { id: request.id, message: request.body, status, error: request.error ?? null, artifact: request.artifact ?? null },
        assistant: response ? { id: response.id, message: response.body, tools: response.tools ?? null, status: response.status ?? "complete", error: response.error ?? null, artifact: response.artifact ?? null } : null,
      },
      conversationLog: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.body,
        status: message.status ?? null,
        error: message.error ?? null,
        tools: message.tools ?? null,
      })),
      aiTransport: transport,
      acceptanceTestSuite: {
        location: "browser client",
        maxAttempts: MAX_RESPONSE_ATTEMPTS,
        rules: [
          "One restricted JSX root with ShiftCutResponse format shiftcut-ai-jsx/v1",
          "Exactly one NoChanges or complete ShiftCutComposition child",
          "Expected and nested composition revisions match the requested current revision",
          "Canvas width, height, FPS, and background are preserved",
          "Complete asset ID/type set is preserved and media references are compatible",
          "Only allowed JSX tags and literal/String.raw attributes are accepted",
          "Every Component references a supplied safe ComponentDefinition",
          "Generated source compiles and passes the deterministic runtime safety contract",
          "Clip timing and duration are finite, positive, frame-aligned, and trims are valid",
          "Elements do not overlap within a track",
          "Animation requests include component code driven by props.localTime",
          "Browser revision still matches before operations are applied",
          "Compiled timeline and component artifacts can be applied atomically",
        ],
        attemptResults: attempts.map((attempt, index) => {
          const record = asRecord(attempt);
          const attemptResponse = asRecord(record?.response);
          const body = asRecord(attemptResponse?.body);
          return {
            attempt: record?.attempt ?? index + 1,
            acceptance: record?.acceptance ?? null,
            httpStatus: attemptResponse?.status ?? null,
            rawModelResponse: body?.content ?? null,
            upstreamDiagnostics: body?.upstream ?? null,
          };
        }),
      },
      editorStateAtExport: {
        project: activeProject,
        selectedElementId: useTimelineStore.getState().selectedElementId,
        timelineWithComponentCode: timelineContext(currentTracks, currentComponents, true),
        componentRegistry: Object.values(currentComponents),
        assets: currentAssets.map((asset) => ({ id: asset.id, name: asset.name, kind: asset.kind, mime: asset.mime, duration: asset.duration, width: asset.width, height: asset.height, size: asset.size })),
      },
      editorResult: request.artifact?.editorResult ?? response?.artifact?.response ?? null,
    };
    await copy(`exchange-${requestIndex}`, `# ShiftCut full debug log\n\n${JSON.stringify(fullPayload, null, 2)}`);
  };
  const requests = messages.flatMap((message, requestIndex) => {
    if (message.role !== "user") return [];
    const responseIndex = messages.findIndex((candidate, index) => index > requestIndex && candidate.role === "assistant" && !messages.slice(requestIndex + 1, index).some((between) => between.role === "user"));
    return [{ request: message, requestIndex, responseIndex: responseIndex === -1 ? undefined : responseIndex }];
  }).reverse();
  return (
    <div className="absolute inset-x-0 top-10 z-40 flex max-h-[70%] flex-col border-b border-[#aaa69f] bg-[#efeeeb] shadow-[0_8px_16px_rgba(0,0,0,.12)]">
      <div className="flex items-center justify-between border-b border-[#d5d2cc] px-4 py-3">
        <div><div className="text-[13px] font-semibold text-[#292724]">Request history</div><p className="mt-0.5 text-[10px] text-[#77726c]">Saved with this project</p></div>
        <button type="button" onClick={onClose} aria-label="Close request history" className="h-6 w-6 text-[15px] text-[#69655f] hover:text-[#292724]">×</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {requests.length === 0 ? <p className="px-2 py-8 text-center text-[12px] text-[#77726c]">No AI requests yet.</p> : (
          <div className="space-y-3">
            {requests.map(({ request, requestIndex, responseIndex }) => {
              const response = responseIndex === undefined ? undefined : messages[responseIndex];
              const status = request.status ?? (response ? "complete" : "pending");
              const statusLabel = status === "complete" ? "Applied / complete" : status === "failed" ? "Failed" : "Pending / unfinished";
              const statusColor = status === "complete" ? "text-[#438d58]" : status === "failed" ? "text-[#b64132]" : "text-[#a27822]";
              return <article key={request.id} className="border border-[#d5d2cc] bg-[#f7f6f4] p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[#89857e]">Request</div>
                <p className="line-clamp-3 text-[11px] leading-4 text-[#49453f]">{request.body}</p>
                <div className={`mt-2 text-[10px] font-semibold ${statusColor}`}>{statusLabel}{request.error ? ` — ${request.error}` : ""}</div>
                {response && <><div className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-[.08em] text-[#89857e]">Response</div>
                  <p className="line-clamp-5 whitespace-pre-wrap text-[11px] leading-4 text-[#49453f]">{response.body}</p></>}
                <button type="button" title="Copies a complete editor debugging bundle: conversation, every AI attempt and raw response, complete JSX prompts, acceptance tests and failures, provider diagnostics, editor state, component code, assets, revisions, and application results." onClick={() => void copyExchange(requestIndex, responseIndex)} className="mt-3 border border-[#c9c7c2] bg-[#efeeeb] px-2 py-1 text-[10px] font-medium text-[#56514c] hover:border-[#77736d]">{copiedKey === `exchange-${requestIndex}` ? "Debug log copied" : "Copy full debug log"}</button>
                {response && <HistoryArtifact artifact={response.artifact} index={responseIndex!} copiedKey={copiedKey} onCopy={copy} />}
              </article>;
            })}
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
    if (Array.isArray(operation.componentDefinitions)) {
      return operation.componentDefinitions.map(asRecord).filter(Boolean).flatMap((definition) => typeof definition?.code === "string"
        ? [{ name: typeof definition.name === "string" ? definition.name : "GeneratedComponent", description: typeof definition.description === "string" ? definition.description : "", code: definition.code }]
        : []);
    }
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
      {operations.some((operation) => typeof operation.compositionSource === "string") && <details>
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[.08em] text-[#6e6963]">Returned JSX composition</summary>
        <div className="mt-2">
          <button type="button" onClick={() => void onCopy(`composition-${index}`, String(operations.find((operation) => typeof operation.compositionSource === "string")?.compositionSource ?? ""))} className="mb-2 border border-[#c9c7c2] bg-[#efeeeb] px-2 py-1 text-[10px] font-medium text-[#56514c] hover:border-[#77736d]">{copiedKey === `composition-${index}` ? "Copied" : "Copy composition"}</button>
          <pre className="max-h-52 overflow-auto border border-[#c9c7c2] bg-[#292724] p-2 text-[9px] leading-3 text-[#ece9e4]"><code>{String(operations.find((operation) => typeof operation.compositionSource === "string")?.compositionSource ?? "")}</code></pre>
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

function projectSnapshot(project: NonNullable<ReturnType<typeof useProjectStore.getState>["activeProject"]>, tracks: TimelineTrack[], pool: ReturnType<typeof useMediaStore.getState>["pool"], components: ReturnType<typeof useComponentStore.getState>["components"], selectedElementId: string | null) {
  // A click in the timeline is always the explicit target. When the user has
  // not clicked one, give the assistant a deterministic fallback instead of
  // making a vague animation request target an arbitrary layer.
  const generatedElements = tracks.flatMap((track) => track.elements.filter((element) => Boolean(element.componentId)));
  const suggestedElementId = selectedElementId ?? (generatedElements.length === 1 ? generatedElements[0].id : null);
  return {
    name: project.name,
    revision: project.revision,
    settings: project.settings,
    selectedElementId,
    suggestedElementId,
    // This is the complete model-facing source of truth. It deliberately
    // includes every referenced immutable component source block.
    composition: serializeShiftCutComposition({ project, tracks, components, assets: pool }),
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
    if (operation.action === "replace_composition") {
      const definitions = Array.isArray(operation.componentDefinitions) ? operation.componentDefinitions.map(asRecord).filter(Boolean) as Record<string, unknown>[] : [];
      if (!definitions.every((definition) => typeof definition.id === "string" && isSafeComponentCode(typeof definition.code === "string" ? definition.code : "", false))) continue;
      const idMap = new Map<string, { id: string; version: number }>();
      for (const definition of definitions) {
        const sourceId = String(definition.id);
        const existing = useComponentStore.getState().get(sourceId);
        const schema = componentSchema(definition.propsSchema);
        const input = {
          name: stringValue(definition.name, existing?.name ?? "GeneratedComponent"),
          description: stringValue(definition.description, existing?.description ?? "AI-generated component"),
          code: String(definition.code),
          propsSchema: schema,
        };
        const unchanged = existing
          && existing.name === input.name
          && existing.description === input.description
          && existing.code === input.code
          && JSON.stringify(existing.propsSchema) === JSON.stringify(input.propsSchema);
        const artifact = unchanged ? existing : useComponentStore.getState().upsert(input, existing?.id);
        idMap.set(sourceId, { id: artifact.id, version: artifact.version });
      }
      const remappedTracks = Array.isArray(operation.tracks) ? operation.tracks.map((rawTrack) => {
        const track = asRecord(rawTrack);
        return {
          ...track,
          elements: Array.isArray(track?.elements) ? track.elements.map((rawElement) => {
            const element = asRecord(rawElement);
            const sourceId = typeof element?.componentId === "string" ? element.componentId : "";
            const target = sourceId ? idMap.get(sourceId) : undefined;
            return target ? { ...element, componentId: target.id, componentVersion: target.version } : element;
          }) : [],
        };
      }) : [];
      const fps = useProjectStore.getState().activeProject?.settings.fps ?? 30;
      const replacement = replacementTimeline(remappedTracks, pool, requireTimelineTime, fps);
      if (!replacement) continue;
      store.replaceTimeline(replacement);
      applied.push("complete JSX composition");
      break;
    }
    if (operation.action === "replace_timeline") {
      const fps = useProjectStore.getState().activeProject?.settings.fps ?? 30;
      const replacement = replacementTimeline(operation.tracks, pool, requireTimelineTime, fps);
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

function replacementTimeline(value: unknown, pool: ReturnType<typeof useMediaStore.getState>["pool"], requireTimelineTime: boolean, fps: number): TimelineTrack[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 32) return null;
  const tracks: TimelineTrack[] = [];
  const usedTrackIds = new Set<string>();
  const usedElementIds = new Set<string>();
  for (const rawTrack of value) {
    const track = asRecord(rawTrack);
    const type: TrackType = track?.type === "audio" ? "audio" : "media";
    const rawElements = Array.isArray(track?.elements) ? track.elements : [];
    const elements: TimelineElement[] = [];
    for (const rawElement of rawElements) {
      const item = asRecord(rawElement);
      if (!item) continue;
      const startTime = frameSeconds(nonNegative(item.startTime), fps);
      const duration = Math.max(1 / fps, frameSeconds(Math.max(0.1, finite(item.duration, 3)), fps));
      const generated = asRecord(item.generatedComponent);
      const requestedId = typeof item.id === "string" && item.id.trim() && !usedElementIds.has(item.id) ? item.id : uid("el");
      usedElementIds.add(requestedId);
      const trimStart = Math.min(Math.max(0, duration - 0.1), nonNegative(item.trimStart));
      const trimEnd = Math.min(Math.max(0, duration - trimStart - 0.1), nonNegative(item.trimEnd));
      const componentId = typeof item.componentId === "string" ? item.componentId : "";
      const existingArtifact = componentId ? useComponentStore.getState().get(componentId) : undefined;
      if (componentId && !existingArtifact) return null;
      if (existingArtifact) {
        if (type !== "media") return null;
        elements.push({
          id: requestedId,
          type: "text",
          name: stringValue(item.name, existingArtifact.name),
          component: "GeneratedReactComponent",
          componentId: existingArtifact.id,
          componentVersion: typeof item.componentVersion === "number" ? item.componentVersion : existingArtifact.version,
          startTime,
          duration,
          trimStart,
          trimEnd,
          params: { ...defaultParams(), ...componentParams(item.params) },
        });
        continue;
      }
      if (generated) {
        const code = typeof generated.code === "string" ? generated.code : "";
        if (!isSafeComponentCode(code, requireTimelineTime) || type !== "media") return null;
        const artifact = useComponentStore.getState().upsert({ name: stringValue(generated.name, "GeneratedComponent"), description: stringValue(generated.description, "AI-generated overlay"), code, propsSchema: componentSchema(generated.propsSchema) });
        elements.push({ id: requestedId, type: "text", name: stringValue(item.name, artifact.name), component: "GeneratedReactComponent", componentId: artifact.id, componentVersion: artifact.version, startTime, duration, trimStart, trimEnd, params: { ...defaultParams(), ...componentParams(item.params) } });
        continue;
      }
      if (item.component === "TextPlayer" && type === "media") {
        elements.push({
          id: requestedId,
          type: "text",
          name: stringValue(item.name, "Text"),
          component: "TextPlayer",
          startTime,
          duration,
          trimStart,
          trimEnd,
          params: { ...defaultParams(), ...componentParams(item.params) },
        });
        continue;
      }
      const mediaId = typeof item.mediaId === "string" ? item.mediaId : "";
      const media = pool.find((asset) => asset.id === mediaId);
      if (!media || (type === "audio") !== (media.kind === "audio")) return null;
      const component = media.kind === "audio" ? "AudioPlayer" : media.kind === "video" ? "VideoPlayer" : "ImagePlayer";
      const sourceDuration = Math.max(0.1, Math.min(duration, media.duration ?? duration));
      const mediaTrimStart = Math.min(Math.max(0, sourceDuration - 0.1), trimStart);
      const mediaTrimEnd = Math.min(Math.max(0, sourceDuration - mediaTrimStart - 0.1), trimEnd);
      elements.push({ id: requestedId, type: "media", mediaId, name: stringValue(item.name, media.name), component, startTime, duration: sourceDuration, trimStart: mediaTrimStart, trimEnd: mediaTrimEnd, params: { ...defaultParams(), ...componentParams(item.params) } });
    }
    const ordered = [...elements].sort((a, b) => a.startTime - b.startTime);
    const frameTolerance = 1 / fps + Number.EPSILON;
    const normalized: TimelineElement[] = [];
    for (const element of ordered) {
      const previous = normalized[normalized.length - 1];
      if (!previous || element.startTime >= elementEnd(previous)) {
        normalized.push(element);
        continue;
      }
      const overlap = elementEnd(previous) - element.startTime;
      if (overlap > frameTolerance) return null;
      normalized.push({ ...element, startTime: elementEnd(previous) });
    }
    const requestedTrackId = typeof track?.id === "string" && track.id.trim() && !usedTrackIds.has(track.id) ? track.id : uid("track");
    usedTrackIds.add(requestedTrackId);
    tracks.push({ id: requestedTrackId, name: stringValue(track?.name, type === "audio" ? "Audio" : "Video"), type, elements: normalized, muted: track?.muted === true, hidden: track?.hidden === true, locked: track?.locked === true });
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
function frameSeconds(value: number, fps: number) { return Math.round(value * Math.max(1, fps)) / Math.max(1, fps); }
function stringValue(value: unknown, fallback: string) { return typeof value === "string" && value.trim() ? value.slice(0, 120) : fallback; }
function defaultParams(): ElementParams { return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, zIndex: 1, volume: 1 }; }

function componentParams(value: unknown): Partial<ElementParams> {
  const record = asRecord(value);
  if (!record) return {};
  const forbidden = new Set(["__proto__", "prototype", "constructor"]);
  const clean = Object.fromEntries(Object.entries(record).filter(([key, item]) =>
    /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)
    && !forbidden.has(key)
    && item !== undefined
    && (() => { try { return JSON.stringify(item).length <= 20_000; } catch { return false; } })(),
  ));
  try {
    return JSON.parse(JSON.stringify(clean)) as Partial<ElementParams>;
  } catch {
    return {};
  }
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
  return timeDriven && code.length <= 16_000 && validateGeneratedComponentSource(code).compatible;
}
