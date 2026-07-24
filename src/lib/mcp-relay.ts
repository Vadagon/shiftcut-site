const SESSION_TTL_SECONDS = 60 * 60 * 6;
const COMMAND_TTL_SECONDS = 60 * 10;

export type McpRelaySession = {
  token: string;
  pairingCode: string;
  projectId: string;
  projectName: string;
  createdAt: number;
  expiresAt: number;
  approved: boolean;
  agentName?: string;
  agentVersion?: string;
};

export type McpRelayCommand = {
  id: string;
  method: string;
  params: Record<string, unknown>;
};

export type McpRelayResult = {
  result?: unknown;
  error?: string;
};

type MemoryState = {
  sessions: Map<string, McpRelaySession>;
  queues: Map<string, McpRelayCommand[]>;
  results: Map<string, { value: McpRelayResult; expiresAt: number }>;
};

const globalRelay = globalThis as typeof globalThis & { __shiftcutMcpRelay?: MemoryState };
const memory = globalRelay.__shiftcutMcpRelay ??= {
  sessions: new Map(),
  queues: new Map(),
  results: new Map(),
};

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const usesRedis = Boolean(redisUrl && redisToken);

function sessionKey(token: string) {
  return `shiftcut:mcp:session:${token}`;
}

function queueKey(token: string) {
  return `shiftcut:mcp:queue:${token}`;
}

function resultKey(token: string, commandId: string) {
  return `shiftcut:mcp:result:${token}:${commandId}`;
}

async function redis(command: Array<string | number>) {
  if (!redisUrl || !redisToken) throw new Error("Upstash Redis is not configured.");
  const response = await fetch(redisUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`MCP relay storage failed (${response.status}).`);
  const body = await response.json() as { result?: unknown; error?: string };
  if (body.error) throw new Error(body.error);
  return body.result;
}

export async function saveMcpSession(session: McpRelaySession) {
  if (usesRedis) {
    await redis(["SET", sessionKey(session.token), JSON.stringify(session), "EX", SESSION_TTL_SECONDS]);
    return;
  }
  memory.sessions.set(session.token, session);
}

export async function readMcpSession(token: string) {
  if (usesRedis) {
    const value = await redis(["GET", sessionKey(token)]);
    return typeof value === "string" ? JSON.parse(value) as McpRelaySession : null;
  }
  const session = memory.sessions.get(token) ?? null;
  if (session && session.expiresAt <= Date.now()) {
    memory.sessions.delete(token);
    return null;
  }
  return session;
}

export async function deleteMcpSession(token: string) {
  if (usesRedis) {
    await redis(["DEL", sessionKey(token), queueKey(token)]);
    return;
  }
  memory.sessions.delete(token);
  memory.queues.delete(token);
}

export async function enqueueMcpCommand(token: string, command: McpRelayCommand) {
  if (usesRedis) {
    await redis(["LPUSH", queueKey(token), JSON.stringify(command)]);
    await redis(["EXPIRE", queueKey(token), COMMAND_TTL_SECONDS]);
    return;
  }
  memory.queues.set(token, [...(memory.queues.get(token) ?? []), command]);
}

export async function takeMcpCommand(token: string) {
  if (usesRedis) {
    const value = await redis(["RPOP", queueKey(token)]);
    return typeof value === "string" ? JSON.parse(value) as McpRelayCommand : null;
  }
  const queue = memory.queues.get(token) ?? [];
  const command = queue.shift() ?? null;
  if (queue.length) memory.queues.set(token, queue);
  else memory.queues.delete(token);
  return command;
}

export async function saveMcpResult(token: string, commandId: string, value: McpRelayResult) {
  if (usesRedis) {
    await redis(["SET", resultKey(token, commandId), JSON.stringify(value), "EX", COMMAND_TTL_SECONDS]);
    return;
  }
  memory.results.set(resultKey(token, commandId), { value, expiresAt: Date.now() + COMMAND_TTL_SECONDS * 1000 });
}

export async function takeMcpResult(token: string, commandId: string) {
  const key = resultKey(token, commandId);
  if (usesRedis) {
    const value = await redis(["GETDEL", key]);
    return typeof value === "string" ? JSON.parse(value) as McpRelayResult : null;
  }
  const entry = memory.results.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    memory.results.delete(key);
    return null;
  }
  memory.results.delete(key);
  return entry.value;
}

