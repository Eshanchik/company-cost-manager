import { NextResponse } from "next/server";

import { authenticateToken } from "@/lib/api/token";
import { handleMcpMessage } from "@/lib/mcp/server";

export const runtime = "nodejs";

// MCP Streamable HTTP endpoint (§6). Bearer-токен, JSON-RPC 2.0.
export async function POST(req: Request) {
  const actor = await authenticateToken(req.headers.get("authorization"));
  if (!actor) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Требуется валидный Bearer-токен" } },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 }
    );
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const m of messages) {
    const res = await handleMcpMessage(actor, m);
    if (res) responses.push(res);
  }

  // Только уведомления → 202 без тела.
  if (responses.length === 0) {
    return new NextResponse(null, { status: 202 });
  }

  const payload = Array.isArray(body) ? responses : responses[0];
  return NextResponse.json(payload, {
    headers: { "Content-Type": "application/json" },
  });
}

// Server-initiated SSE-поток не поддерживается (stateless-режим).
export async function GET() {
  return new NextResponse("Method Not Allowed", { status: 405 });
}
