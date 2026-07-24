import { enqueueMcpCommand, readMcpSession, saveMcpSession, takeMcpResult } from "@/lib/mcp-relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
};

const TOOL_METHODS: Record<string, string> = {
  get_status: "status",
  get_revision: "get_revision",
  get_project: "get_project",
  list_assets: "list_assets",
  apply_transaction: "apply_transaction",
  replace_component: "replace_component",
  upload_assets: "upload_assets",
  download_assets: "download_assets",
  screenshot_at: "screenshot",
  screenshot_player_at: "screenshot_player",
  export_video: "export_video",
};

const TOOLS = [
  tool("get_status", "Check the open ShiftCut project connection.", {}),
  tool("get_revision", "Read the current revision before planning an edit.", {}),
  tool("get_project", "Read the project, timeline, components, and asset metadata.", {}),
  tool("list_assets", "List project or global assets.", { scope: { type: "string", enum: ["project", "global"], default: "project" } }),
  tool("apply_transaction", "Apply one revision-safe structured editor transaction.", { transaction: { type: "object" } }, ["transaction"]),
  tool("replace_component", "Replace one generated visual component as one revision-safe edit.", {
    expectedRevision: { type: "integer", minimum: 0 },
    elementId: { type: "string" },
    code: { type: "string" },
    compositionDescription: { type: "string" },
    summary: { type: "string" },
  }, ["expectedRevision", "elementId", "code", "compositionDescription", "summary"]),
  tool("upload_assets", "Upload base64-encoded files into the open project.", { files: { type: "array", items: { type: "object" } } }, ["files"]),
  tool("download_assets", "Read project assets as base64 files.", { assetIds: { type: "array", items: { type: "string" } } }),
  tool("screenshot_at", "Render an exact PNG frame at a timeline second.", { second: { type: "number", minimum: 0 } }, ["second"]),
  tool("screenshot_player_at", "Capture the live HTML player at a timeline second.", { second: { type: "number", minimum: 0 } }, ["second"]),
  tool("export_video", "Render the open project as a base64 MP4.", {
    scale: { type: "number", minimum: 0.1, maximum: 2, default: 1 },
    quality: { type: "string", enum: ["low", "medium", "high"], default: "medium" },
    includeAudio: { type: "boolean", default: true },
  }),
];

export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) return rpcError(null, -32001, "Invalid or missing ShiftCut pairing token.", 401);
  const session = await readMcpSession(token);
  if (!session) return rpcError(null, -32001, "This ShiftCut pairing link has expired.", 401);

  let message: JsonRpcRequest;
  try {
    message = await request.json() as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error.");
  }
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") return rpcError(message.id ?? null, -32600, "Invalid Request.");

  if (message.method === "initialize") {
    const clientInfo = message.params?.clientInfo as { name?: unknown; version?: unknown } | undefined;
    await saveMcpSession({
      ...session,
      agentName: typeof clientInfo?.name === "string" ? clientInfo.name : "MCP agent",
      agentVersion: typeof clientInfo?.version === "string" ? clientInfo.version : undefined,
    });
    return rpcResult(message.id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "shiftcut", version: "0.2.0" },
    });
  }
  if (message.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (message.method === "ping") return rpcResult(message.id, {});
  if (message.method === "tools/list") return rpcResult(message.id, { tools: TOOLS });
  if (message.method !== "tools/call") return rpcError(message.id ?? null, -32601, "Method not found.");
  if (!session.approved) return rpcError(message.id ?? null, -32002, "Approve this agent in the open ShiftCut editor before using project tools.");

  const name = message.params?.name;
  const bridgeMethod = typeof name === "string" ? TOOL_METHODS[name] : undefined;
  if (!bridgeMethod) return rpcError(message.id ?? null, -32602, "Unknown ShiftCut tool.");
  const commandId = crypto.randomUUID();
  await enqueueMcpCommand(token, {
    id: commandId,
    method: bridgeMethod,
    params: message.params?.arguments && typeof message.params.arguments === "object"
      ? message.params.arguments as Record<string, unknown>
      : {},
  });
  const result = await waitForResult(token, commandId, request.signal);
  if (!result) return rpcError(message.id ?? null, -32003, "The ShiftCut editor did not answer before the command timed out.");
  if (result.error) return rpcResult(message.id, { content: [{ type: "text", text: result.error }], isError: true });
  return rpcResult(message.id, { content: [{ type: "text", text: JSON.stringify(result.result, null, 2) }] });
}

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[] = []) {
  return { name, description, inputSchema: { type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false } };
}

async function waitForResult(token: string, commandId: string, signal: AbortSignal) {
  const deadline = Date.now() + 285_000;
  while (!signal.aborted && Date.now() < deadline) {
    const result = await takeMcpResult(token, commandId);
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

function rpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result }, { headers: { "Cache-Control": "no-store" } });
}

function rpcError(id: JsonRpcRequest["id"] | null, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

