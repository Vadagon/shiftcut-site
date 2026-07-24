"use client";

import { useEffect, useRef, useState } from "react";
import type { McpStatusDetail } from "./mcp-bridge";

export function McpAgentSelector({ placement = "below", compact = false }: { placement?: "above" | "below"; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<McpStatusDetail>({ state: "unavailable", connected: false });
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = (event: Event) => setStatus((event as CustomEvent<McpStatusDetail>).detail);
    const openSelector = (event: Event) => {
      const requestedPlacement = (event as CustomEvent<{ placement?: "above" | "below" }>).detail?.placement;
      if (!requestedPlacement || requestedPlacement === placement) setOpen(true);
    };
    window.addEventListener("shiftcut:mcp-status", update);
    window.addEventListener("shiftcut:mcp-open", openSelector);
    return () => {
      window.removeEventListener("shiftcut:mcp-status", update);
      window.removeEventListener("shiftcut:mcp-open", openSelector);
    };
  }, [placement]);

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

  const connected = status.state === "connected";

  return (
    <div ref={rootRef} className={compact ? "absolute right-3 top-3 z-40" : "relative"}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap py-1 text-[10px] font-semibold text-[#8d8982] hover:text-[#4f4b46]"
      >
        <i className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-[#4f9662]" : "bg-[#aaa69f]"}`} />
        {connected ? `${status.agentName || "Agent"} · connected` : "Connect agent"}
        <span className="text-[8px]">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Connect an AI agent"
          className={`absolute right-0 z-50 w-[310px] border border-[#c9c7c2] bg-[#f6f5f2] p-3 text-left shadow-[0_8px_24px_rgba(0,0,0,.16)] ${placement === "above" ? "bottom-7" : "top-7"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold text-[#3f3b37]">{heading(status)}</p>
              <p className="mt-1 text-[10px] leading-4 text-[#77726c]">{description(status)}</p>
            </div>
            {connected && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("shiftcut:mcp-revoke"))}
                className="shrink-0 border border-[#c8a6a1] bg-[#fff8f7] px-2 py-1 text-[9px] font-semibold text-[#a34a3d] hover:bg-[#f7e2df]"
              >
                Revoke
              </button>
            )}
          </div>

          {!connected && status.mcpUrl && (
            <div className="mt-3 border-t border-[#d7d4cf] pt-3">
              <ol className="space-y-2 text-[10px] leading-4 text-[#5f5a54]">
                <li><span className="mr-1.5 font-semibold text-[#3f3b37]">1.</span>Copy your private MCP connection URL.</li>
                <li><span className="mr-1.5 font-semibold text-[#3f3b37]">2.</span>Paste it into Codex, ChatGPT, Claude, or any remote MCP client.</li>
              </ol>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(status.mcpUrl ?? "");
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }}
                className="mt-3 w-full border border-[#bdb9b3] bg-[#f7f6f4] px-2 py-2 text-[10px] font-semibold text-[#5b5751] hover:bg-[#e4e1dc]"
              >
                {copied ? "MCP URL copied" : "Copy MCP connection URL"}
              </button>
              <p className="mt-2 text-center text-[9px] text-[#8a857e]">Pairing code: <span className="font-mono font-semibold text-[#5b5751]">{status.pairingCode}</span> · expires in 6 hours</p>
            </div>
          )}

          {(status.state === "unavailable" || status.state === "error") && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("shiftcut:mcp-reconnect"))}
              className="mt-3 border border-[#bdb9b3] bg-[#f7f6f4] px-2 py-1 text-[9px] font-semibold text-[#5b5751] hover:bg-[#e4e1dc]"
            >
              Create a new link
            </button>
          )}

          <p className="mt-3 border-t border-[#d7d4cf] pt-2 text-[9px] leading-4 text-[#8a857e]">No installation or approval step required. Anyone with this private link can access the open project until you revoke it or it expires.</p>
        </div>
      )}
    </div>
  );
}

function heading(status: McpStatusDetail) {
  if (status.state === "connected") return `${status.agentName || "MCP agent"} is connected`;
  if (status.state === "error") return "Could not create the MCP link";
  return "Connect any AI agent";
}

function description(status: McpStatusDetail) {
  if (status.state === "connected") return "The agent can use tools on this project until you revoke access or the link expires.";
  if (status.state === "error") return status.error || "The connection service is temporarily unavailable.";
  return "Use one secure URL with any agent that supports remote MCP over HTTP.";
}
