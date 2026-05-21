import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { validateEnv } from "./lib/env-check";

validateEnv();

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      const check = validateEnv();
      return new Response(
        JSON.stringify({
          status: check.ok ? "ok" : "degraded",
          env: check.env,
          supabase: check.missing.some((k) => k.startsWith("VITE_SUPABASE"))
            ? "missing"
            : "configured",
          sentry: check.sentry,
          ts: new Date().toISOString(),
        }),
        {
          status: check.ok ? 200 : 503,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      captureSsrError(error);
      return brandedErrorResponse();
    }
  },
};

function captureSsrError(error: unknown): void {
  const dsn = (globalThis as Record<string, unknown>)["VITE_SENTRY_DSN"] as string | undefined
    ?? (typeof process !== "undefined" ? process.env.VITE_SENTRY_DSN : undefined);
  if (!dsn) return;

  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    const endpoint = `${url.protocol}//${url.host}/api/${projectId}/envelope/`;

    const message = error instanceof Error ? error.message : String(error ?? "SSR error");
    const stack = error instanceof Error ? (error.stack ?? "") : "";

    const envelope = [
      JSON.stringify({ event_id: crypto.randomUUID(), sent_at: new Date().toISOString() }),
      JSON.stringify({ type: "event" }),
      JSON.stringify({
        event_id: crypto.randomUUID(),
        level: "error",
        platform: "javascript",
        environment: "production",
        exception: {
          values: [{ type: "Error", value: message, stacktrace: { frames: stack ? [{ filename: "server.ts", function: "fetch", abs_path: stack }] : [] } }],
        },
      }),
    ].join("\n");

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_key=${url.username}, sentry_version=7`,
      },
      body: envelope,
    }).catch(() => {/* swallow — never let telemetry break the response path */});
  } catch {
    // Never let Sentry reporting break the response.
  }
}

