import { deleteMcpSession, readMcpSession, saveMcpResult, saveMcpSession, takeMcpCommand } from "@/lib/mcp-relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(value);
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const token = searchParams.get("token");
  if (!validToken(token)) return Response.json({ error: "Invalid MCP session token." }, { status: 400 });
  const session = await readMcpSession(token);
  if (!session) return Response.json({ error: "MCP session expired." }, { status: 404 });
  const command = session.approved && searchParams.get("status") !== "1" ? await takeMcpCommand(token) : null;
  return Response.json({ session, command }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Untrusted origin." }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!validToken(body.token)) return Response.json({ error: "Invalid MCP session token." }, { status: 400 });

  if (body.action === "create") {
    if (typeof body.projectId !== "string" || typeof body.projectName !== "string" || typeof body.pairingCode !== "string") {
      return Response.json({ error: "Project information is required." }, { status: 400 });
    }
    await saveMcpSession({
      token: body.token,
      pairingCode: body.pairingCode,
      projectId: body.projectId,
      projectName: body.projectName.slice(0, 160),
      createdAt: Date.now(),
      expiresAt: Date.now() + 6 * 60 * 60 * 1000,
      // Possession of the unguessable capability URL grants project access.
      // Users can revoke it at any time, which rotates to a fresh token.
      approved: true,
    });
    return Response.json({ ok: true });
  }

  const session = await readMcpSession(body.token);
  if (!session) return Response.json({ error: "MCP session expired." }, { status: 404 });
  if (body.action === "approve") {
    await saveMcpSession({ ...session, approved: true });
    return Response.json({ ok: true });
  }
  if (body.action === "revoke") {
    await deleteMcpSession(body.token);
    return Response.json({ ok: true });
  }
  if (body.action === "result" && typeof body.commandId === "string") {
    await saveMcpResult(body.token, body.commandId, {
      ...(body.error === undefined ? { result: body.result } : { error: String(body.error) }),
    });
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unsupported MCP session action." }, { status: 400 });
}
