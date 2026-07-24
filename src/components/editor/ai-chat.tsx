"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { useMediaStore } from "@/stores/media-store";
import { usePanelStore } from "@/stores/panel-store";
import { useComponentStore } from "@/stores/component-store";
import { storageService } from "@/lib/storage/storage-service";
import type { ChatMemoryData, ProjectRevision } from "@/lib/storage/types";
import { uid } from "@/lib/utils";
import { type TimelineElement, type TimelineTrack } from "@/types/timeline";
import type { ProjectSettings } from "@/types/project";
import { serializeCompactProject } from "@/lib/composition-dsl";
import { parseCompactProject } from "@/lib/composition-dsl-parser";
import { buildFocusedComponentPrompt, buildTransactionPrompt, parseComponentResult, parseEditorTransaction, requestsProjectMutation, simulateTransaction, type ComponentJob, type ComponentResult, type EditorTransaction } from "@/lib/ai-transaction-protocol";
import { McpAgentSelector } from "./mcp-agent-selector";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  body: string;
  tools?: string;
  artifact?: Record<string, unknown>;
  status?: "pending" | "failed" | "complete";
  error?: string;
};

type ProgressStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "complete" | "failed";
};

type RequestCheckpoint = {
  revision: number;
  plan: Extract<EditorTransaction, { type: "editor_transaction" }>;
  stagedTracks: TimelineTrack[];
  settings: ProjectSettings;
  componentJobs: ComponentJob[];
  componentResults: ComponentResult[];
  nextComponentIndex: number;
};

const RECENT_RAW_MESSAGES = 8;
const COMPACT_AFTER_MESSAGES = 12;
const COMPACT_AFTER_CHARS = 16_000;
const MAX_RESPONSE_ATTEMPTS = 3;

function currentTimestamp() {
  return Date.now();
}

function waitForRetry(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
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
  const [workLabel, setWorkLabel] = useState("Analyzing timeline and project");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [progressOpenId, setProgressOpenId] = useState<string | null>(null);
  const [copiedErrorId, setCopiedErrorId] = useState<string | null>(null);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const project = useProjectStore((state) => state.activeProject);
  const tracks = useTimelineStore((state) => state.tracks);
  const selectedElementId = useTimelineStore((state) => state.selectedElementId);
  const pool = useMediaStore((state) => state.pool);
  const components = useComponentStore((state) => state.components);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/subscription/status", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result: { active?: unknown } | null) => {
        if (!cancelled) setSubscriptionActive(result?.active === true);
      })
      .catch(() => {
        if (!cancelled) setSubscriptionActive(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const sendRequest = async (value: string, requestId?: string, resumeCheckpoint?: RequestCheckpoint) => {
    if (!value || isSending) return;
    const requestedResolution = extractRequestedResolution(value);
    if (resumeCheckpoint && requestedResolution
      && (resumeCheckpoint.settings.width !== requestedResolution.width || resumeCheckpoint.settings.height !== requestedResolution.height)) {
      resumeCheckpoint = undefined;
    }
    const requestSnapshot = project ? projectSnapshot(project, tracks, pool, components, selectedElementId, value) : undefined;
    const messageId = requestId ?? uid("msg");
    let progressSteps: ProgressStep[] = resumeCheckpoint ? readProgress(messages.find((message) => message.id === requestId)?.artifact).map((step) => ({
      ...step,
      status: step.status === "failed" ? "running" : step.status,
    })) : [
      { id: "context", label: "Prepare project context", status: "running" },
      { id: "timeline", label: "Plan and validate timeline", status: "pending" },
      { id: "commit", label: "Apply one atomic revision", status: "pending" },
    ];
    let checkpoint = resumeCheckpoint;
    let transportArtifact: Record<string, unknown> = {
      endpoint: "/api/chat",
      method: "POST",
      requestHeaders: { "Content-Type": "application/json" },
      startedAt: currentTimestamp(),
      requestBody: null,
      response: null,
    };
    const requestArtifact = () => ({ transport: transportArtifact, progress: progressSteps, ...(checkpoint ? { checkpoint } : {}) });
    const setStep = (id: string, status: ProgressStep["status"]) => {
      progressSteps = progressSteps.map((step) => step.id === id ? { ...step, status } : step);
      updateMessage(messageId, { artifact: requestArtifact() });
    };
    const pendingMessage: ChatMessage = { id: messageId, role: "user", body: value, status: "pending", artifact: requestArtifact() };
    const requestMessages = requestId
      ? messages.map((message) => message.id === messageId ? { ...message, status: "pending" as const, error: undefined } : message)
      : [...messages, pendingMessage];
    if (requestId) updateMessage(requestId, { status: "pending", error: undefined, artifact: requestArtifact() });
    else {
      appendMessage(pendingMessage);
    }
    setDraft("");
    setRetryAttempt(null);
    setRequestPhase("thinking");
    setWorkLabel("Analyzing timeline and project");
    setIsSending(true);
    try {
      setRequestPhase("compacting");
      setWorkLabel("Preparing project context");
      const context = project ? await compactContext(project.id, requestMessages, memory) : { memory, messages: modelMessages(requestMessages), compactionTransport: null };
      if (context.memory !== memory) setMemory(context.memory);
      setStep("context", "complete");
      setStep("timeline", "running");
      setRequestPhase("thinking");
      setWorkLabel("Analyzing timeline and project");
      if (!requestSnapshot) throw new Error("No active project composition is available.");
      const recentRevisions = project ? await storageService.loadRevisions(project.id) : [];
      const recentChanges = recentProjectChanges(recentRevisions, requestSnapshot.settings, requestSnapshot.revision);
      const systemPrompt = buildTransactionPrompt({
        projectName: requestSnapshot.name,
        revision: requestSnapshot.revision,
        compactProject: requestSnapshot.compactProject,
        memory: context.memory?.summary ?? "",
        recentChanges,
        selectedElementId: requestSnapshot.selectedElementId,
        suggestedElementId: requestSnapshot.suggestedElementId,
      });
      // Keep recent raw turns so short follow-ups such as "replace", "yes", or
      // "make it faster" retain their conversational referent. The system
      // prompt still makes the current project snapshot authoritative.
      const baseMessages = [{ role: "system" as const, content: systemPrompt }, ...context.messages];
      const attempts: Record<string, unknown>[] = [];
      async function runStage<T>(stage: "timeline" | "component", label: string, stageMessages: Array<{ role: "system" | "user" | "assistant"; content: string }>, accept: (raw: string) => T): Promise<T> {
        let retryMessages = stageMessages;
        let lastAcceptanceError = "The model returned an empty response.";
        for (let attempt = 1; attempt <= MAX_RESPONSE_ATTEMPTS; attempt += 1) {
          setRetryAttempt(attempt > 1 ? attempt : null);
          setRequestPhase(attempt > 1 ? "retrying" : "thinking");
          setWorkLabel(label);
          const requestBody = { messages: retryMessages };
          const attemptStartedAt = currentTimestamp();
          transportArtifact = {
            ...transportArtifact,
            requestBody: transportArtifact.requestBody ?? requestBody,
            auxiliaryRequests: context.compactionTransport ? [context.compactionTransport] : [],
            response: { attempts: [...attempts], activeStage: stage, activeAttempt: attempt },
          };
          updateMessage(messageId, { artifact: requestArtifact() });
          const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
          const responseBody = await response.json().catch(() => null) as { content?: unknown; error?: unknown; upstream?: unknown } | null;
          const attemptRecord: Record<string, unknown> = {
            stage,
            attempt,
            requestBody,
            startedAt: attemptStartedAt,
            response: { status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()), body: responseBody, completedAt: currentTimestamp() },
          };
          attempts.push(attemptRecord);
          if (!response.ok) {
            lastAcceptanceError = typeof responseBody?.error === "string" ? responseBody.error : "AI proxy request failed.";
            attemptRecord.acceptance = { passed: false, error: lastAcceptanceError };
            if (response.status >= 400 && response.status < 500) throw new Error(lastAcceptanceError);
          } else {
            const rawContent = typeof responseBody?.content === "string" ? responseBody.content : "";
            try {
              if (!rawContent.trim()) throw new Error("The model returned an empty response.");
              const accepted = accept(rawContent);
              attemptRecord.acceptance = { passed: true };
              transportArtifact = { ...transportArtifact, response: { attempts: [...attempts], activeStage: null, activeAttempt: null } };
              updateMessage(messageId, { artifact: requestArtifact() });
              return accepted;
            } catch (error) {
              lastAcceptanceError = error instanceof Error ? error.message : "The returned JSX failed client acceptance.";
              attemptRecord.acceptance = { passed: false, error: lastAcceptanceError };
              retryMessages = [
                ...stageMessages,
                ...(rawContent ? [{ role: "assistant" as const, content: rawContent }] : []),
                { role: "user" as const, content: `Client ${stage} validation failed: ${lastAcceptanceError} Return exactly one valid JSON object matching the required schema. Do not include prose or Markdown.` },
              ];
            }
          }
          transportArtifact = { ...transportArtifact, response: { attempts: [...attempts], activeStage: stage, activeAttempt: null } };
          updateMessage(messageId, { artifact: requestArtifact() });
          if (attempt < MAX_RESPONSE_ATTEMPTS) {
            setWorkLabel(response.ok ? `${label} · correcting response` : `${label} · provider failed, retrying`);
            await waitForRetry(attempt * 750);
          }
        }
        throw new Error(`The AI ${stage} response failed after ${MAX_RESPONSE_ATTEMPTS} total attempts: ${lastAcceptanceError}`);
      }

      if (checkpoint && checkpoint.revision !== requestSnapshot.revision) {
        throw new Error("The project revision changed after this request failed. Retry the complete request against the current project.");
      }
      const planned = checkpoint
        ? { plan: checkpoint.plan, simulation: { tracks: checkpoint.stagedTracks, componentJobs: checkpoint.componentJobs, settings: checkpoint.settings } }
        : await runStage("timeline", "Planning editor transaction", baseMessages, (raw) => {
          const plan = parseEditorTransaction(raw, requestSnapshot.revision);
          if (plan.type === "no_changes" && requestsProjectMutation(value)) {
            throw new Error("The user gave an actionable editor outcome. Inspect the current project, choose reasonable implementation details, and return an editor_transaction that performs the work instead of asking for preferences.");
          }
          if (/\b(?:all|everything|complete|entire|full)\b/i.test(value)
            && plan.type === "editor_transaction"
            && /\b(?:next steps?|would add|add later|placeholder|follow[- ]?up)\b/i.test(`${plan.summary} ${plan.reply}`)) {
            throw new Error("The user requested the complete job, but the plan deferred requested work to a later step.");
          }
          const simulation = plan.type === "editor_transaction"
            ? simulateTransaction({ transaction: plan, tracks, assets: pool, settings: requestSnapshot.settings })
            : null;
          if (simulation && requestedResolution && (simulation.settings.width !== requestedResolution.width || simulation.settings.height !== requestedResolution.height)) {
            throw new Error(`The user requested ${requestedResolution.width}×${requestedResolution.height}, but the transaction canvas remains ${simulation.settings.width}×${simulation.settings.height}. Add update_project_settings as the first operation.`);
          }
          if (plan.type === "editor_transaction" && simulation
            && simulation.componentJobs.length === 0
            && sameTimeline(tracks, simulation.tracks)
            && sameProjectSettings(requestSnapshot.settings, simulation.settings)) {
            throw new Error("The transaction is a no-op. Return no_changes with a useful clarification question, or return operations that materially change the current project.");
          }
          return { plan, simulation };
        });
      const { plan } = planned;
      setStep("timeline", "complete");
      const stagedTracks = planned.simulation?.tracks ?? structuredClone(tracks);
      const componentResults: ComponentResult[] = checkpoint ? [...checkpoint.componentResults] : [];
      if (plan.type === "editor_transaction" && planned.simulation) {
        const simulation = planned.simulation;
        if (!checkpoint) {
          const componentSteps: ProgressStep[] = simulation.componentJobs.map((job, index) => ({
            id: `component:${index}`,
            label: `${job.kind === "edit" ? "Update" : "Generate"} component ${index + 1}/${simulation.componentJobs.length}`,
            status: "pending",
          }));
          progressSteps = [
            ...progressSteps.filter((step) => step.id !== "commit"),
            ...componentSteps,
            progressSteps.find((step) => step.id === "commit")!,
          ];
          checkpoint = {
            revision: requestSnapshot.revision,
            plan,
            stagedTracks,
            settings: simulation.settings,
            componentJobs: simulation.componentJobs,
            componentResults: [],
            nextComponentIndex: 0,
          };
        }
        updateMessage(messageId, { artifact: requestArtifact() });
        for (const [jobIndex, job] of simulation.componentJobs.entries()) {
          if (jobIndex < (checkpoint?.nextComponentIndex ?? 0)) continue;
          setStep(`component:${jobIndex}`, "running");
          const revisionBeforeFocus = useProjectStore.getState().activeProject?.revision;
          if (revisionBeforeFocus !== requestSnapshot.revision) throw new Error("The project changed before component generation. Retry with the current revision.");
          const original = tracks.flatMap((track) => track.elements).find((element) => element.id === job.elementId);
          const artifact = original?.componentId ? useComponentStore.getState().get(original.componentId) : undefined;
          if (job.kind === "edit" && (!original || !artifact)) throw new Error(`Component source for ${job.elementId} is unavailable.`);
          const componentPrompt = buildFocusedComponentPrompt({
            revision: requestSnapshot.revision,
            job,
            artifact,
            element: original,
            projectWidth: simulation.settings.width,
            projectHeight: simulation.settings.height,
            fps: simulation.settings.fps,
          });
          const generated = await runStage(
            "component",
            `Generating component ${jobIndex + 1}/${simulation.componentJobs.length}`,
            [{ role: "system", content: componentPrompt }, { role: "user", content: job.instruction }],
            (raw) => parseComponentResult(raw, {
              expectedRevision: requestSnapshot.revision,
              elementId: job.elementId,
              requireAnimation: /\b(?:animate|animation|explode|explosion|burst|particle|motion|bounce|slide|zoom|transition)\b/i.test(job.instruction),
            }),
          );
          componentResults.push(generated);
          if (checkpoint) checkpoint = { ...checkpoint, componentResults: [...componentResults], nextComponentIndex: jobIndex + 1 };
          setStep(`component:${jobIndex}`, "complete");
        }
      }
      transportArtifact = { ...transportArtifact, response: { attempts: [...attempts], finalResult: { plan, componentResults }, completedAt: currentTimestamp() } };
      setStep("commit", "running");
      setWorkLabel("Applying accepted changes");
      setRequestPhase("thinking");
      setRetryAttempt(null);
      const reply = componentResults.at(-1)?.reply ?? plan.reply;
      const currentRevision = useProjectStore.getState().activeProject?.revision;
      const revisionMatches = currentRevision !== undefined && plan.expectedRevision === currentRevision;
      const applied = revisionMatches && plan.type === "editor_transaction"
        ? commitTransaction(plan, stagedTracks, componentResults, planned.simulation?.settings ?? requestSnapshot.settings)
        : [];
      if (plan.type === "editor_transaction" && !applied.length) throw new Error(revisionMatches
        ? "The accepted transaction produced no project change. Nothing was changed."
        : "The project changed while AI was responding. Nothing was changed; retry with the current revision.");
      const resultingTimeline = timelineContext(useTimelineStore.getState().tracks, useComponentStore.getState().components, true);
      progressSteps = progressSteps.map((step) => ({ ...step, status: "complete" as const }));
      updateMessage(messageId, { status: "complete", error: undefined, artifact: { ...requestArtifact(), editorResult: { receivedAtRevision: currentRevision ?? null, revisionMatches, applied, timelineAfter: resultingTimeline } } });
      appendMessage({ id: uid("msg"), role: "assistant", body: reply, tools: applied.length ? `Applied: ${applied.join(", ")}` : undefined, artifact: {
        transport: transportArtifact,
        request: requestSnapshot,
        response: { expectedRevision: plan.expectedRevision, receivedAtRevision: currentRevision ?? null, revisionMatches, transaction: plan, componentResults, applied, timelineAfter: resultingTimeline },
      } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI response failed.";
      progressSteps = progressSteps.map((step) => step.status === "running" ? { ...step, status: "failed" } : step);
      const priorResponse = asRecord(transportArtifact.response);
      transportArtifact = { ...transportArtifact, response: { ...priorResponse, error: message, completedAt: currentTimestamp() } };
      updateMessage(messageId, { status: "failed", error: message, artifact: requestArtifact() });
    } finally {
      setIsSending(false);
      setRetryAttempt(null);
      setRequestPhase("thinking");
      setWorkLabel("Analyzing timeline and project");
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || isSending) return;
    if (!subscriptionActive) {
      setPaywallOpen(true);
      return;
    }
    void sendRequest(draft.trim());
  };

  const copyErrorDebugLog = async (request: ChatMessage) => {
    const requestIndex = messages.findIndex((message) => message.id === request.id);
    const response = messages.find((message, index) => index > requestIndex && message.role === "assistant");
    const currentProject = useProjectStore.getState().activeProject;
    const currentTracks = useTimelineStore.getState().tracks;
    const currentComponents = useComponentStore.getState().components;
    const currentAssets = useMediaStore.getState().pool;
    const payload = buildDebugLog({
      messages,
      request,
      response,
      level: "full",
      runtime: { pageUrl: window.location.href, userAgent: navigator.userAgent, language: navigator.language, online: navigator.onLine },
      editorState: {
        project: currentProject,
        selectedElementId: useTimelineStore.getState().selectedElementId,
        timelineWithComponentCode: timelineContext(currentTracks, currentComponents, true),
        componentRegistry: Object.values(currentComponents),
        assets: currentAssets.map((asset) => ({ id: asset.id, name: asset.name, kind: asset.kind, mime: asset.mime, duration: asset.duration, width: asset.width, height: asset.height, size: asset.size })),
      },
    });
    await navigator.clipboard.writeText(`# UltraCut full debug error\n\n${JSON.stringify(payload, null, 2)}`);
    setCopiedErrorId(request.id);
    window.setTimeout(() => setCopiedErrorId(null), 1600);
  };

  return (
    <aside className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#edebe8] text-[#302e2b]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#c9c7c2] px-4 text-[12px] font-semibold tracking-[0.02em]">
        <span>AI</span>
        <button type="button" title="Request history" aria-label="Request history" onClick={() => setHistoryOpen((open) => !open)} className="flex h-7 w-7 items-center justify-center text-[16px] font-normal text-[#69655f] hover:bg-[#e2dfdb] hover:text-[#292724]">▤</button>
      </div>
      {historyOpen && <HistoryDrawer messages={messages} onClose={() => setHistoryOpen(false)} />}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-6">
        <div className="min-w-0 space-y-6">
          {messages.map((message) => {
            const progress = readProgress(message.artifact);
            const progressOpen = progressOpenId === message.id;
            return (
              <div key={message.id} className={`flex min-w-0 max-w-full ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`min-w-0 max-w-[88%] overflow-hidden rounded-[3px] px-3 py-2 text-[13px] leading-5 text-[#292724] ${message.role === "user" ? "bg-[#e1dfdc]" : "border border-[#d4d1cc] bg-[#f7f6f4]"}`}>
                  {message.tools && <div className="mb-2 flex items-center gap-2 text-[12px] text-[#807d78]"><span className="h-2 w-2 rounded-full bg-[#438d58]" />{message.tools}</div>}
                  <MessageText content={message.body} />
                  {message.role === "user" && message.status && message.status !== "complete" && (
                    <>
                      <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#c9c7c2] pt-2 text-[10px] text-[#77726c]">
                        <span className={`flex min-w-0 items-start gap-2 ${message.status === "failed" ? "text-[#b64132]" : ""}`}>
                          {message.status === "failed" && (
                            <button type="button" title={copiedErrorId === message.id ? "Debug error copied" : "Copy full debug error"} aria-label="Copy full debug error" onClick={() => void copyErrorDebugLog(message)} className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#c7c3bd] bg-[#efede9] text-[#6c6761] hover:border-[#9d9891] hover:bg-[#e6e3de] hover:text-[#34312e]">
                              {copiedErrorId === message.id ? "✓" : <BugIcon />}
                            </button>
                          )}
                          <span>{message.status === "failed" ? `Failed: ${message.error ?? "No response"}` : statusText(workLabel, requestPhase, retryAttempt)}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <button type="button" onClick={() => setProgressOpenId(progressOpen ? null : message.id)} className="whitespace-nowrap font-semibold text-[#57524c] underline underline-offset-2 hover:text-[#292724]">{progressOpen ? "Hide progress" : "Show progress"}</button>
                        </span>
                      </div>
                      {progressOpen && <RequestProgress steps={progress} retryDisabled={isSending} onRetry={(stepId) => {
                        if (!stepId) return;
                        // A failed final commit means the accepted checkpoint
                        // itself was stale or ineffective. Replan instead of
                        // replaying the same commit forever.
                        const savedCheckpoint = stepId === "commit" ? undefined : readCheckpoint(message.artifact);
                        void sendRequest(message.body, message.id, savedCheckpoint);
                      }} />}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {isSending && <ThinkingIndicator retryAttempt={retryAttempt} phase={requestPhase} workLabel={workLabel} />}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="shrink-0 px-5 pb-4 pt-2">
        <div className="mb-2 text-[10px] text-[#827d76]">Project revision {project?.revision ?? "—"} · synced automatically</div>
        <form onSubmit={submit} className="relative rounded-[5px] border border-[#c9c7c2] bg-[#f8f7f5] p-3 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
          <McpAgentSelector placement="above" compact />
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
      {paywallOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="ai-subscription-title" className="absolute inset-0 z-[100] flex items-center justify-center bg-black/35 p-5">
          <div className="w-full max-w-[360px] border border-[#bdb9b3] bg-[#f8f7f5] p-5 shadow-[0_18px_50px_rgba(0,0,0,.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="ai-subscription-title" className="text-[16px] font-semibold text-[#302e2b]">Use AI editing</h2>
                <p className="mt-2 text-[12px] leading-5 text-[#69645e]">Subscribe to use UltraCut AI, or connect your own agent over MCP.</p>
              </div>
              <button type="button" onClick={() => setPaywallOpen(false)} aria-label="Close" className="text-[19px] leading-none text-[#77726c] hover:text-[#302e2b]">×</button>
            </div>
            <div className="mt-5 grid gap-2">
              <Link href="/pricing" className="flex h-10 items-center justify-center rounded-[4px] bg-[#e57438] px-4 text-[12px] font-semibold text-white hover:bg-[#d96930]">Subscribe</Link>
              <button
                type="button"
                onClick={() => {
                  setPaywallOpen(false);
                  window.setTimeout(() => window.dispatchEvent(new CustomEvent("shiftcut:mcp-open", { detail: { placement: "above" } })), 0);
                }}
                className="h-10 rounded-[4px] border border-[#aaa69f] bg-[#f7f6f4] px-4 text-[12px] font-semibold text-[#514c46] hover:bg-[#e7e4df]"
              >
                Connect your own agent
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function MessageText({ content }: { content: string }) {
  return (
    <div className="max-w-full overflow-x-auto overscroll-x-contain">
      <p className="w-full min-w-0 whitespace-pre-wrap break-normal">
        {content.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**")
          ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>
          : part)}
      </p>
    </div>
  );
}

function BugIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m8 2 1.9 2.4M16 2l-1.9 2.4M3 13h4M17 13h4M5 7l2.2 1.5M19 7l-2.2 1.5M5 19l2.4-1.6M19 19l-2.4-1.6" />
      <rect x="7" y="5" width="10" height="16" rx="5" />
      <path d="M7 11h10M12 11v10" />
    </svg>
  );
}

function readProgress(artifact?: Record<string, unknown>): ProgressStep[] {
  if (!Array.isArray(artifact?.progress)) return [];
  return artifact.progress.flatMap((value) => {
    const step = asRecord(value);
    if (!step || typeof step.id !== "string" || typeof step.label !== "string") return [];
    if (step.status !== "pending" && step.status !== "running" && step.status !== "complete" && step.status !== "failed") return [];
    return [{ id: step.id, label: step.label, status: step.status }];
  });
}

function readCheckpoint(artifact?: Record<string, unknown>): RequestCheckpoint | undefined {
  const checkpoint = asRecord(artifact?.checkpoint);
  const plan = asRecord(checkpoint?.plan);
  if (!checkpoint || plan?.type !== "editor_transaction" || typeof checkpoint.revision !== "number") return undefined;
  const settings = asRecord(checkpoint.settings);
  if (!settings || typeof settings.width !== "number" || typeof settings.height !== "number" || typeof settings.fps !== "number") return undefined;
  if (!Array.isArray(checkpoint.stagedTracks) || !Array.isArray(checkpoint.componentJobs) || !Array.isArray(checkpoint.componentResults) || typeof checkpoint.nextComponentIndex !== "number") return undefined;
  const parsed = checkpoint as unknown as RequestCheckpoint;
  const currentProject = useProjectStore.getState().activeProject;
  const cannotProduceAChange = parsed.componentJobs.length === 0
    && sameTimeline(useTimelineStore.getState().tracks, parsed.stagedTracks)
    && Boolean(currentProject)
    && sameProjectSettings(currentProject!.settings, parsed.settings);
  return cannotProduceAChange ? undefined : parsed;
}

function RequestProgress({ steps, retryDisabled, onRetry }: { steps: ProgressStep[]; retryDisabled: boolean; onRetry: (stepId: string) => void }) {
  return (
    <div className="mt-2 space-y-1.5 border-t border-[#c9c7c2] pt-2">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-2 text-[10px] text-[#68635d]">
          <span className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[8px] ${
            step.status === "complete" ? "bg-[#4d8f5d] text-white"
              : step.status === "running" ? "animate-pulse border border-[#8b867f] bg-[#f5f3f0]"
                : step.status === "failed" ? "bg-[#b64132] text-white"
                  : "border border-[#bbb7b0]"
          }`}>{step.status === "complete" ? "✓" : step.status === "failed" ? "!" : ""}</span>
          <span className={step.status === "pending" ? "text-[#99948d]" : undefined}>{step.label}</span>
          {step.status !== "failed" && <span className="ml-auto text-[9px] capitalize text-[#99948d]">{step.status}</span>}
          {step.status === "failed" && <span className="ml-auto" />}
          {step.status === "failed" && <button type="button" disabled={retryDisabled} onClick={() => onRetry(step.id)} className="text-[9px] font-semibold text-[#57524c] underline underline-offset-2 disabled:opacity-40">Retry</button>}
        </div>
      ))}
    </div>
  );
}

function statusText(workLabel: string, phase: "compacting" | "thinking" | "retrying", retryAttempt: number | null) {
  if (phase === "compacting") return "Preparing project context";
  if (phase === "retrying") return `${workLabel} — response invalid, retrying ${retryAttempt ?? 2}/3`;
  return workLabel;
}

function ThinkingIndicator({ retryAttempt, phase, workLabel }: { retryAttempt: number | null; phase: "compacting" | "thinking" | "retrying"; workLabel: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-[13px] text-[#77726c]">
      <span>{statusText(workLabel, phase, retryAttempt)}</span>
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
  const copyExchange = async (requestIndex: number, responseIndex: number | undefined, level: "summary" | "full") => {
    const request = messages[requestIndex];
    const response = responseIndex === undefined ? undefined : messages[responseIndex];
    const activeProject = useProjectStore.getState().activeProject;
    const currentTracks = useTimelineStore.getState().tracks;
    const currentComponents = useComponentStore.getState().components;
    const currentAssets = useMediaStore.getState().pool;
    const payload = buildDebugLog({
      messages, request, response, level,
      runtime: { pageUrl: window.location.href, userAgent: navigator.userAgent, language: navigator.language, online: navigator.onLine },
      editorState: {
        project: activeProject,
        selectedElementId: useTimelineStore.getState().selectedElementId,
        timelineWithComponentCode: timelineContext(currentTracks, currentComponents, true),
        componentRegistry: Object.values(currentComponents),
        assets: currentAssets.map((asset) => ({ id: asset.id, name: asset.name, kind: asset.kind, mime: asset.mime, duration: asset.duration, width: asset.width, height: asset.height, size: asset.size })),
      },
    });
    const label = level === "summary" ? "UltraCut debug summary" : "UltraCut full debug log";
    await copy(`${level}-${requestIndex}`, `# ${label}\n\n${JSON.stringify(payload, null, 2)}`);
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" title="Copies a concise diagnosis: stages, targets, revision outcome, project diff, failed tests, timing, token use, and warnings." onClick={() => void copyExchange(requestIndex, responseIndex, "summary")} className="border border-[#c9c7c2] bg-[#efeeeb] px-2 py-1 text-[10px] font-medium text-[#56514c] hover:border-[#77736d]">{copiedKey === `summary-${requestIndex}` ? "Summary copied" : "Copy debug summary"}</button>
                  <button type="button" title="Copies the summary plus deduplicated raw prompts, responses, transport diagnostics, conversation, and editor state." onClick={() => void copyExchange(requestIndex, responseIndex, "full")} className="border border-[#c9c7c2] bg-[#efeeeb] px-2 py-1 text-[10px] font-medium text-[#56514c] hover:border-[#77736d]">{copiedKey === `full-${requestIndex}` ? "Full log copied" : "Copy full debug log"}</button>
                </div>
                {response && <HistoryArtifact artifact={response.artifact} index={responseIndex!} copiedKey={copiedKey} onCopy={copy} />}
              </article>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const ACCEPTANCE_RULES = [
  "Response is one valid JSON object for the active stage",
  "Expected revision matches the request snapshot",
  "Transaction contains only supported bounded operations",
  "Element, track, asset, and temporary references resolve",
  "The complete transaction simulates before any timeline mutation",
  "Generated component compiles and passes runtime safety checks",
  "Timing is finite, positive, frame-aligned, and trims are valid",
  "Elements do not overlap within a track",
  "Requested animation is deterministic and driven by localTime",
  "Browser revision still matches before one atomic timeline commit",
];

type DebugLogInput = {
  messages: ChatMessage[];
  request: ChatMessage;
  response?: ChatMessage;
  level: "summary" | "full";
  runtime: Record<string, unknown>;
  editorState: Record<string, unknown>;
};

function buildDebugLog({ messages, request, response, level, runtime, editorState }: DebugLogInput) {
  const transport = request.artifact?.transport ?? response?.artifact?.transport ?? null;
  const transportRecord = asRecord(transport);
  const transportResponse = asRecord(transportRecord?.response);
  const attempts = Array.isArray(transportResponse?.attempts) ? transportResponse.attempts.map(asRecord).filter(Boolean) as Record<string, unknown>[] : [];
  const result = asRecord(response?.artifact?.response) ?? asRecord(request.artifact?.editorResult);
  const requestSnapshot = asRecord(response?.artifact?.request);
  const compactProject = typeof requestSnapshot?.compactProject === "string" ? requestSnapshot.compactProject : "";
  let beforeTracks: Record<string, unknown>[] = [];
  try { beforeTracks = compactProject ? parseCompactProject(compactProject).tracks : []; } catch { /* Included as a warning below. */ }
  const afterTracks = Array.isArray(result?.timelineAfter) ? result.timelineAfter.map(asRecord).filter(Boolean) as Record<string, unknown>[] : [];
  const projectDiff = diffTimelines(beforeTracks, afterTracks);
  const stageTimeline = attempts.map((attempt, index) => summarizeAttempt(attempt, index));
  const failedTests = stageTimeline.flatMap((attempt) => attempt.acceptance.passed ? [] : [{
    stage: attempt.stage,
    attempt: attempt.attempt,
    error: attempt.acceptance.error ?? "Response rejected without a saved reason.",
  }]);
  const acceptedStages = stageTimeline.filter((attempt) => attempt.acceptance.passed).map((attempt) => `${attempt.stage} attempt ${attempt.attempt}`);
  const selectedElementId = stringOrNull(requestSnapshot?.selectedElementId);
  const suggestedElementId = stringOrNull(requestSnapshot?.suggestedElementId);
  const requestedTargets = stageTimeline.flatMap((attempt) => attempt.target.elementId ? [attempt.target] : []);
  const applied = Array.isArray(result?.applied) ? result.applied : [];
  const status = request.status ?? (response ? "complete" : "unfinished");
  const warnings = debugWarnings({
    status, attempts: stageTimeline, selectedElementId, suggestedElementId, requestedTargets,
    projectDiff, applied, revisionMatches: result?.revisionMatches,
    compactProjectParsed: !compactProject || beforeTracks.length > 0,
  });
  const performance = summarizePerformance(transportRecord, transportResponse, stageTimeline);
  const log: Record<string, unknown> = {
    debugLogVersion: "shiftcut-debug/v3",
    level,
    exportedAt: new Date().toISOString(),
    summary: {
      request: request.body,
      status,
      error: request.error ?? response?.error ?? transportResponse?.error ?? null,
      assistantReply: response?.body ?? null,
      stages: [...new Set(stageTimeline.map((attempt) => attempt.stage))],
      attempts: stageTimeline.length,
      applied,
      revision: {
        sent: requestSnapshot?.revision ?? null,
        expected: result?.expectedRevision ?? null,
        receivedAt: result?.receivedAtRevision ?? null,
        matched: result?.revisionMatches ?? null,
      },
      warnings,
    },
    stageTimeline,
    targetResolution: {
      selectedElementId,
      suggestedElementId,
      requestedTargets,
      continuity: targetContinuity(requestedTargets),
    },
    projectDiff,
    acceptance: {
      location: "browser client",
      maxAttemptsPerStage: MAX_RESPONSE_ATTEMPTS,
      failed: failedTests,
      criticalPassed: acceptedStages,
      rules: ACCEPTANCE_RULES,
    },
    performance,
  };
  if (level === "full") {
    log.rawEvidence = deduplicatedEvidence({ messages, request, response, attempts, compactProject, transportRecord, editorState, runtime });
  }
  return log;
}

function summarizeAttempt(attempt: Record<string, unknown>, index: number) {
  const response = asRecord(attempt.response);
  const body = asRecord(response?.body);
  const upstream = asRecord(body?.upstream);
  const usage = asRecord(upstream?.usage);
  const routing = asRecord(upstream?.routing);
  const acceptance = asRecord(attempt.acceptance);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const root = firstTag(content);
  const startedAt = finite(attempt.startedAt, 0);
  const completedAt = finite(response?.completedAt, 0);
  return {
    stage: typeof attempt.stage === "string" ? attempt.stage : "unknown",
    attempt: finite(attempt.attempt, index + 1),
    result: acceptance?.passed === true ? "accepted" : "rejected",
    responseRoot: root,
    httpStatus: response?.status ?? null,
    durationMs: startedAt && completedAt ? Math.max(0, completedAt - startedAt) : null,
    acceptance: { passed: acceptance?.passed === true, error: stringOrNull(acceptance?.error) },
    target: root === "RequestComponent" || root === "ComponentEdit" ? responseTarget(content) : { elementId: null, componentId: null, componentVersion: null },
    provider: {
      requestId: upstream?.requestId ?? null,
      model: upstream?.model ?? routing?.requested ?? null,
      finishReason: upstream?.finishReason ?? upstream?.nativeFinishReason ?? null,
      region: routing?.region ?? null,
    },
    usage: {
      promptTokens: finite(usage?.prompt_tokens, 0),
      completionTokens: finite(usage?.completion_tokens, 0),
      reasoningTokens: finite(asRecord(usage?.completion_tokens_details)?.reasoning_tokens, 0),
      totalTokens: finite(usage?.total_tokens, 0),
      costUsd: finite(usage?.cost, 0),
    },
  };
}

function firstTag(source: string) {
  const candidate = source.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(candidate) as { type?: unknown };
    if (typeof parsed?.type === "string") return parsed.type;
  } catch { /* Older JSX logs remain readable. */ }
  return source.match(/^\s*(?:```(?:jsx|tsx|javascript)?\s*)?<([A-Za-z][\w]*)/)?.[1] ?? null;
}

function responseTarget(source: string) {
  return {
    elementId: jsxStringAttribute(source, "elementId") ?? jsxStringAttribute(source, "targetElementId"),
    componentId: jsxStringAttribute(source, "componentId") ?? jsxStringAttribute(source, "baseComponentId"),
    componentVersion: jsxNumberAttribute(source, "componentVersion") ?? jsxNumberAttribute(source, "baseComponentVersion"),
  };
}

function jsxStringAttribute(source: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`\\b${escaped}=\\{?["']([^"']+)["']\\}?`))?.[1] ?? null;
}

function jsxNumberAttribute(source: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`\\b${escaped}=\\{?(-?\\d+(?:\\.\\d+)?)\\}?`));
  return match ? Number(match[1]) : null;
}

function flattenDebugElements(tracks: Record<string, unknown>[]) {
  return tracks.flatMap((track, trackIndex): Record<string, unknown>[] => {
    const elements = Array.isArray(track.elements) ? track.elements.map(asRecord).filter(Boolean) as Record<string, unknown>[] : [];
    return elements.map((element, elementIndex): Record<string, unknown> => ({ ...element, trackId: track.id, trackIndex, elementIndex }));
  });
}

function diffTimelines(beforeTracks: Record<string, unknown>[], afterTracks: Record<string, unknown>[]) {
  const beforeTrackIds = beforeTracks.map((track) => String(track.id ?? ""));
  const afterTrackIds = afterTracks.map((track) => String(track.id ?? ""));
  const beforeElements = flattenDebugElements(beforeTracks);
  const afterElements = flattenDebugElements(afterTracks);
  const beforeById = new Map(beforeElements.map((element) => [String(element.id), element]));
  const afterById = new Map(afterElements.map((element) => [String(element.id), element]));
  const added = afterElements.filter((element) => !beforeById.has(String(element.id))).map(elementDigest);
  const removed = beforeElements.filter((element) => !afterById.has(String(element.id))).map(elementDigest);
  const watched = ["name", "trackId", "startTime", "duration", "trimStart", "trimEnd", "mediaId", "componentId", "componentVersion", "params"];
  const updated = afterElements.flatMap((after) => {
    const before = beforeById.get(String(after.id));
    if (!before) return [];
    const changedFields = watched.filter((key) => stableJson(before[key]) !== stableJson(after[key]));
    return changedFields.length ? [{ id: after.id, name: after.name, changedFields }] : [];
  });
  return {
    available: beforeTracks.length > 0 && afterTracks.length > 0,
    tracks: {
      added: afterTrackIds.filter((id) => !beforeTrackIds.includes(id)),
      removed: beforeTrackIds.filter((id) => !afterTrackIds.includes(id)),
      reordered: stableJson(beforeTrackIds.filter((id) => afterTrackIds.includes(id))) !== stableJson(afterTrackIds.filter((id) => beforeTrackIds.includes(id))),
      beforeCount: beforeTracks.length,
      afterCount: afterTracks.length,
    },
    elements: { added, removed, updated, beforeCount: beforeElements.length, afterCount: afterElements.length },
    durationSeconds: { before: timelineDuration(beforeElements), after: timelineDuration(afterElements) },
  };
}

function elementDigest(element: Record<string, unknown>) {
  return { id: element.id ?? null, name: element.name ?? null, trackId: element.trackId ?? null, startTime: element.startTime ?? null, duration: element.duration ?? null, componentId: element.componentId ?? null, mediaId: element.mediaId ?? null };
}

function timelineDuration(elements: Record<string, unknown>[]) {
  return elements.reduce((maximum, element) => Math.max(maximum, finite(element.startTime, 0) + finite(element.duration, 0) - finite(element.trimStart, 0) - finite(element.trimEnd, 0)), 0);
}

function targetContinuity(targets: Array<{ elementId: string | null; componentId: string | null; componentVersion: number | null }>) {
  if (targets.length < 2) return targets.length === 1 ? "single-stage target" : "no explicit target";
  const first = targets[0];
  return targets.every((target) => target.elementId === first.elementId && target.componentId === first.componentId) ? "matched across stages" : "target changed across stages";
}

function debugWarnings(input: {
  status: string;
  attempts: ReturnType<typeof summarizeAttempt>[];
  selectedElementId: string | null;
  suggestedElementId: string | null;
  requestedTargets: Array<{ elementId: string | null; componentId: string | null; componentVersion: number | null }>;
  projectDiff: ReturnType<typeof diffTimelines>;
  applied: unknown[];
  revisionMatches: unknown;
  compactProjectParsed: boolean;
}) {
  const warnings: string[] = [];
  if (input.status === "failed") warnings.push("request-failed");
  if (input.attempts.some((attempt) => attempt.attempt > 1)) warnings.push("response-retried");
  if (input.attempts.some((attempt) => attempt.responseRoot === null)) warnings.push("empty-or-unrecognized-model-response");
  if (input.revisionMatches === false) warnings.push("project-revision-changed-before-apply");
  if (input.attempts.some((attempt) => attempt.acceptance.passed) && input.applied.length === 0 && input.status === "complete") warnings.push("accepted-with-no-editor-change");
  if (input.projectDiff.tracks.added.length) warnings.push("tracks-added");
  if (input.projectDiff.tracks.removed.length) warnings.push("tracks-removed");
  if (input.projectDiff.elements.added.length) warnings.push("elements-added");
  if (input.projectDiff.durationSeconds.before !== input.projectDiff.durationSeconds.after) warnings.push("timeline-duration-changed");
  if (!input.compactProjectParsed) warnings.push("sent-project-could-not-be-parsed-for-diff");
  const targetIds = input.requestedTargets.map((target) => target.elementId).filter(Boolean);
  if (input.selectedElementId && targetIds.length && !targetIds.includes(input.selectedElementId)) warnings.push("selected-element-was-not-targeted");
  if (!input.selectedElementId && input.suggestedElementId && targetIds.length && !targetIds.includes(input.suggestedElementId)) warnings.push("suggested-element-was-not-targeted");
  if (targetContinuity(input.requestedTargets) === "target changed across stages") warnings.push("component-target-changed-between-stages");
  return warnings;
}

function summarizePerformance(transport: Record<string, unknown> | null, response: Record<string, unknown> | null, attempts: ReturnType<typeof summarizeAttempt>[]) {
  const startedAt = finite(transport?.startedAt, 0);
  const completedAt = finite(response?.completedAt, 0);
  return {
    totalDurationMs: startedAt && completedAt ? Math.max(0, completedAt - startedAt) : null,
    attempts: attempts.length,
    promptTokens: attempts.reduce((sum, attempt) => sum + attempt.usage.promptTokens, 0),
    completionTokens: attempts.reduce((sum, attempt) => sum + attempt.usage.completionTokens, 0),
    reasoningTokens: attempts.reduce((sum, attempt) => sum + attempt.usage.reasoningTokens, 0),
    totalTokens: attempts.reduce((sum, attempt) => sum + attempt.usage.totalTokens, 0),
    costUsd: attempts.reduce((sum, attempt) => sum + attempt.usage.costUsd, 0),
  };
}

function deduplicatedEvidence(input: {
  messages: ChatMessage[];
  request: ChatMessage;
  response?: ChatMessage;
  attempts: Record<string, unknown>[];
  compactProject: string;
  transportRecord: Record<string, unknown> | null;
  editorState: Record<string, unknown>;
  runtime: Record<string, unknown>;
}) {
  const blobs: Record<string, { kind: string; value: unknown }> = {};
  const refs = new Map<string, string>();
  const add = (kind: string, value: unknown) => {
    const serialized = stableJson(value);
    const existing = refs.get(serialized);
    if (existing) return existing;
    const ref = `blob-${Object.keys(blobs).length + 1}`;
    refs.set(serialized, ref);
    blobs[ref] = { kind, value };
    return ref;
  };
  const compactProjectRef = input.compactProject ? add("compact-project-jsx", input.compactProject) : null;
  const attemptEvidence = input.attempts.map((attempt, index) => {
    const response = asRecord(attempt.response);
    const body = asRecord(response?.body);
    const requestBody = asRecord(attempt.requestBody);
    const requestMessages = Array.isArray(requestBody?.messages) ? requestBody.messages.map(asRecord).filter(Boolean) as Record<string, unknown>[] : [];
    const normalizedMessages = requestMessages.map((message) => ({
      ...message,
      content: typeof message.content === "string" && input.compactProject
        ? message.content.replaceAll(input.compactProject, `[[see ${compactProjectRef}]]`)
        : message.content,
    }));
    return {
      stage: attempt.stage ?? "unknown",
      attempt: attempt.attempt ?? index + 1,
      requestMessagesRef: add("ai-request-messages", normalizedMessages),
      rawResponseRef: add("raw-model-response", body?.content ?? null),
      upstreamDiagnosticsRef: add("upstream-diagnostics", body?.upstream ?? null),
      http: { status: response?.status ?? null, statusText: response?.statusText ?? null, headers: response?.headers ?? null },
      acceptance: attempt.acceptance ?? null,
    };
  });
  return {
    note: "Large values are stored once in blobs and referenced by ID.",
    compactProjectRef,
    selectedExchangeRef: add("selected-exchange", {
      request: { id: input.request.id, message: input.request.body, status: input.request.status ?? null, error: input.request.error ?? null, artifact: input.request.artifact ?? null },
      response: input.response ? { id: input.response.id, message: input.response.body, status: input.response.status ?? null, error: input.response.error ?? null, tools: input.response.tools ?? null, artifact: input.response.artifact ?? null } : null,
    }),
    conversationRef: add("conversation", input.messages.map((message) => ({ id: message.id, role: message.role, content: message.body, status: message.status ?? null, error: message.error ?? null, tools: message.tools ?? null }))),
    transportEnvelopeRef: add("transport-envelope", input.transportRecord ? { ...input.transportRecord, response: undefined } : null),
    editorStateRef: add("editor-state-at-export", input.editorState),
    runtimeRef: add("runtime", input.runtime),
    attempts: attemptEvidence,
    blobs,
  };
}

function stableJson(value: unknown) {
  try { return JSON.stringify(value); } catch { return String(value); }
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function HistoryArtifact({ artifact, index, copiedKey, onCopy }: { artifact?: Record<string, unknown>; index: number; copiedKey: string | null; onCopy: (key: string, text: string) => Promise<void> }) {
  if (!artifact) return <p className="mt-3 text-[10px] leading-4 text-[#89857e]">Structured component and timeline details are available for new requests.</p>;
  const response = asRecord(artifact.response);
  const operations = Array.isArray(response?.operations) ? response.operations.map(asRecord).filter(Boolean) as Record<string, unknown>[] : [];
  const transactionComponents = Array.isArray(response?.componentResults)
    ? response.componentResults.map(asRecord).filter(Boolean).flatMap((component) => typeof component?.code === "string"
      ? [{ name: typeof component.name === "string" ? component.name : "GeneratedComponent", description: typeof component.description === "string" ? component.description : "", code: component.code }]
      : [])
    : [];
  const components = [...transactionComponents, ...operations.flatMap((operation) => {
    if (Array.isArray(operation.componentDefinitions)) {
      return operation.componentDefinitions.map(asRecord).filter(Boolean).flatMap((definition) => typeof definition?.code === "string"
        ? [{ name: typeof definition.name === "string" ? definition.name : "GeneratedComponent", description: typeof definition.description === "string" ? definition.description : "", code: definition.code }]
        : []);
    }
    const component = asRecord(operation.component);
    const code = typeof component?.code === "string" ? component.code : null;
    return code ? [{ name: typeof component?.name === "string" ? component.name : "GeneratedComponent", description: typeof component?.description === "string" ? component.description : "", code }] : [];
  })];
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

function projectSnapshot(project: NonNullable<ReturnType<typeof useProjectStore.getState>["activeProject"]>, tracks: TimelineTrack[], pool: ReturnType<typeof useMediaStore.getState>["pool"], components: ReturnType<typeof useComponentStore.getState>["components"], selectedElementId: string | null, userRequest = "") {
  // A click in the timeline is always the explicit target. When the user has
  // not clicked one, give the assistant a deterministic fallback instead of
  // making a vague animation request target an arbitrary layer.
  const generatedElements = tracks.flatMap((track) => track.elements.filter((element) => Boolean(element.componentId)));
  const requestWords = new Set(userRequest.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length > 2) ?? []);
  const ranked = generatedElements.map((element) => {
    const component = element.componentId ? components[element.componentId] : undefined;
    const searchable = `${element.name} ${component?.name ?? ""} ${component?.description ?? ""} ${String(element.params.text ?? "")}`.toLowerCase();
    const score = [...requestWords].reduce((total, word) => total + (searchable.includes(word) ? 1 : 0), 0);
    return { id: element.id, score };
  }).sort((a, b) => b.score - a.score);
  const lexicalSuggestion = ranked[0]?.score > 0 && ranked[0].score > (ranked[1]?.score ?? -1) ? ranked[0].id : null;
  const suggestedElementId = selectedElementId ?? (generatedElements.length === 1 ? generatedElements[0].id : lexicalSuggestion);
  return {
    name: project.name,
    revision: project.revision,
    settings: project.settings,
    selectedElementId,
    suggestedElementId,
    compactProject: serializeCompactProject({ project, tracks, components, assets: pool }),
  };
}

function recentProjectChanges(revisions: ProjectRevision[], currentSettings: ProjectSettings, currentRevision: number) {
  const recent = revisions.slice(-8);
  const lines = recent.map((revision) => {
    const settings = revision.project.settings;
    return `r${revision.revision}: ${revision.summary} · canvas ${settings.width}×${settings.height} @ ${settings.fps}fps`;
  });
  const lastRecorded = recent.at(-1);
  if (lastRecorded && !sameProjectSettings(lastRecorded.project.settings, currentSettings)) {
    lines.push(`After r${lastRecorded.revision}, project settings changed to ${currentSettings.width}×${currentSettings.height} @ ${currentSettings.fps}fps (current r${currentRevision}).`);
  }
  return lines.join("\n");
}

function extractRequestedResolution(request: string) {
  const match = request.match(/\b(?:resolution|canvas|video\s+size|output\s+size)\b[^0-9]{0,40}(\d{2,4})\s*[x×]\s*(\d{2,4})/i);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
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

function commitTransaction(plan: Extract<EditorTransaction, { type: "editor_transaction" }>, stagedTracks: TimelineTrack[], componentResults: ComponentResult[], settings: ProjectSettings) {
  const store = useTimelineStore.getState();
  const next = structuredClone(stagedTracks);
  for (const result of componentResults) {
    let target: TimelineElement | undefined;
    for (const track of next) {
      target = track.elements.find((element) => element.id === result.elementId);
      if (target) break;
    }
    if (!target) return [];
    const existing = target.componentId ? useComponentStore.getState().get(target.componentId) : undefined;
    const artifact = useComponentStore.getState().upsert({
      name: result.name,
      description: result.description,
      code: result.code,
      propsSchema: result.propsSchema,
    }, existing?.id);
    target.component = "GeneratedReactComponent";
    target.type = "text";
    target.componentId = artifact.id;
    target.componentVersion = artifact.version;
    target.name = target.name || artifact.name;
    target.description = result.description;
  }
  const activeProject = useProjectStore.getState().activeProject;
  const settingsChanged = Boolean(activeProject) && !sameProjectSettings(activeProject!.settings, settings);
  const descriptionChanged = Boolean(activeProject) && activeProject!.compositionDescription !== plan.compositionDescription;
  const timelineChanged = !sameTimeline(store.tracks, next);
  if (!timelineChanged && !settingsChanged && !descriptionChanged) return [];
  if (settingsChanged) useProjectStore.getState().setSettingsForCommit(settings);
  if (descriptionChanged) useProjectStore.getState().setCompositionDescriptionForCommit(plan.compositionDescription);
  if (timelineChanged) store.replaceTimeline(next, plan.summary);
  else useProjectStore.getState().bumpRevision();
  const selected = componentResults.at(-1)?.elementId;
  if (selected) {
    store.selectElement(selected);
    usePanelStore.getState().setActive("inspector");
  }
  return [`transaction: ${plan.operations.length} operation${plan.operations.length === 1 ? "" : "s"}${settingsChanged ? ` · ${settings.width}×${settings.height}` : ""}`];
}

function sameTimeline(left: TimelineTrack[], right: TimelineTrack[]) {
  const comparable = (items: TimelineTrack[]) => items.map((track) => ({
    id: track.id,
    name: track.name,
    type: track.type,
    muted: track.muted,
    hidden: track.hidden,
    locked: track.locked,
    elements: track.elements.map((element) => ({
      id: element.id,
      name: element.name,
      component: element.component,
      componentId: element.componentId,
      componentVersion: element.componentVersion,
      mediaId: element.mediaId,
      startTime: element.startTime,
      duration: element.duration,
      trimStart: element.trimStart,
      trimEnd: element.trimEnd,
      params: element.params,
    })),
  }));
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}

function sameProjectSettings(left: ProjectSettings, right: ProjectSettings) {
  return left.width === right.width
    && left.height === right.height
    && left.fps === right.fps
    && (left.background ?? "#000000") === (right.background ?? "#000000");
}

function asRecord(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function finite(value: unknown, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
