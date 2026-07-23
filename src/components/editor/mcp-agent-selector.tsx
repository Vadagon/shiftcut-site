"use client";

import { useEffect, useRef, useState } from "react";

type Agent = {
  id: "codex" | "claude" | "gemini";
  name: string;
  detail: string;
};

const AGENTS: Agent[] = [
  { id: "codex", name: "Codex", detail: "Connect Codex to ShiftCut’s MCP server, then authorize access to the current project." },
  { id: "claude", name: "Claude", detail: "Add ShiftCut as an MCP server in Claude Desktop or Claude Code, then open this project." },
  { id: "gemini", name: "Gemini", detail: "Register ShiftCut’s MCP endpoint in Gemini CLI, then grant access to the current project." },
];

export function McpAgentSelector({ placement = "below", compact = false }: { placement?: "above" | "below"; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<Agent["id"] | null>(null);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = (event: Event) => setConnected(Boolean((event as CustomEvent<{ connected?: boolean }>).detail?.connected));
    window.addEventListener("shiftcut:mcp-status", update);
    return () => window.removeEventListener("shiftcut:mcp-status", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={compact ? "absolute right-3 top-3 z-40" : "relative"}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap py-1 text-[10px] font-semibold text-[#8d8982] hover:text-[#4f4b46]"
      >
        <i className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-[#4f9662]" : "bg-[#aaa69f]"}`} />
        MCP{connected ? " · connected" : ""}
        <span className="text-[8px]">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="MCP agents"
          className={`absolute right-0 z-50 w-[272px] border border-[#c9c7c2] bg-[#f6f5f2] p-1.5 text-left shadow-[0_8px_24px_rgba(0,0,0,.16)] ${placement === "above" ? "bottom-7" : "top-7"}`}
        >
          <div className="border-b border-[#d7d4cf] px-2 pb-2 pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold text-[#3f3b37]">{connected ? "MCP connection live" : "Connect your AI agent"}</p>
              {connected && (
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("shiftcut:mcp-disconnect"));
                    setOpen(false);
                  }}
                  className="border border-[#c8a6a1] bg-[#fff8f7] px-2 py-1 text-[9px] font-semibold text-[#a34a3d] hover:bg-[#f7e2df]"
                >
                  Disconnect
                </button>
              )}
            </div>
            <p className="mt-0.5 text-[10px] leading-4 text-[#77726c]">{connected ? "The open project is connected to an MCP agent." : "Connect an MCP agent, then keep this project tab open."}</p>
            {!connected && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("shiftcut:mcp-reconnect"))}
                className="mt-2 border border-[#bdb9b3] bg-[#f7f6f4] px-2 py-1 text-[9px] font-semibold text-[#5b5751] hover:bg-[#e4e1dc]"
              >
                Reconnect
              </button>
            )}
          </div>
          {AGENTS.map((agent) => {
            const expanded = expandedAgent === agent.id;
            return (
              <div key={agent.id} className="border-b border-[#dfdcd7] last:border-0">
                <button
                  type="button"
                  role="menuitem"
                  aria-expanded={expanded}
                  onClick={() => setExpandedAgent(expanded ? null : agent.id)}
                  className="flex w-full items-center gap-2 px-2 py-2 text-[11px] text-[#48443f] hover:bg-[#e8e5e0]"
                >
                  <span className="h-2 w-2 rounded-full border border-[#aaa69f] bg-[#dedbd6]" />
                  <span className="flex-1 font-semibold">{agent.name}</span>
                  <span className={`text-[9px] font-medium ${connected && agent.id === "codex" ? "text-[#4f9662]" : "text-[#9a958e]"}`}>{connected && agent.id === "codex" ? "Connected" : "Setup"}</span>
                  <span className="text-[#77726c]">{expanded ? "−" : "+"}</span>
                </button>
                {expanded && (
                  <div className="bg-[#eeece8] px-4 py-3 text-[10px] leading-4 text-[#68635d]">
                    <p>{agent.detail}</p>
                    <button type="button" onClick={() => {
                      const command = agent.id === "codex"
                        ? "codex mcp add shiftcut -- node /Users/movebender/Work/video-editor/shiftcut-mcp/dist/server.js"
                        : `Configure ${agent.name} with stdio command: node /Users/movebender/Work/video-editor/shiftcut-mcp/dist/server.js`;
                      void navigator.clipboard.writeText(command);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    }} className="mt-2 w-full border border-[#bdb9b3] bg-[#f7f6f4] px-2 py-1.5 font-semibold text-[#5b5751] hover:bg-[#e4e1dc]">
                      {copied ? "Setup copied" : `Copy ${agent.name} setup`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
