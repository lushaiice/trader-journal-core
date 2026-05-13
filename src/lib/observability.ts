/**
 * Lightweight production observability.
 *
 * No third-party SDK. No PII / financial values are ever logged. Captures
 * structured events to console (collectible by hosting platform logs) and
 * keeps a small in-memory ring buffer for the in-app diagnostics view.
 *
 * Design intent:
 *   - Calm. Never surface stack traces to the user.
 *   - Cheap. No network telemetry by default.
 *   - Safe. Redact anything that looks like a number/amount before logging.
 */

export type ObservabilityLevel = "info" | "warn" | "error";

export interface ObservabilityEvent {
  level: ObservabilityLevel;
  scope: string;
  message: string;
  meta?: Record<string, unknown>;
  at: string;
}

const RING_LIMIT = 50;
const ring: ObservabilityEvent[] = [];

const SENSITIVE_KEYS = new Set([
  "amount",
  "price",
  "entry_price",
  "exit_price",
  "quantity",
  "pnl",
  "capital",
  "equity",
  "email",
  "password",
  "token",
  "access_token",
  "refresh_token",
]);

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "number") return "[redacted:number]";
  if (typeof value === "string") {
    if (value.length > 256) return value.slice(0, 256) + "…";
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[redacted]" : redact(v);
    }
    return out;
  }
  return value;
}

export function track(
  level: ObservabilityLevel,
  scope: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  const event: ObservabilityEvent = {
    level,
    scope,
    message,
    meta: meta ? (redact(meta) as Record<string, unknown>) : undefined,
    at: new Date().toISOString(),
  };
  ring.push(event);
  if (ring.length > RING_LIMIT) ring.shift();

  const payload = JSON.stringify(event);
  if (level === "error") console.error("[observability]", payload);
  else if (level === "warn") console.warn("[observability]", payload);
  else console.info("[observability]", payload);
}

export const observability = {
  info: (scope: string, message: string, meta?: Record<string, unknown>) =>
    track("info", scope, message, meta),
  warn: (scope: string, message: string, meta?: Record<string, unknown>) =>
    track("warn", scope, message, meta),
  error: (scope: string, message: string, meta?: Record<string, unknown>) =>
    track("error", scope, message, meta),
  recent: (): ObservabilityEvent[] => [...ring],
  clear: () => {
    ring.length = 0;
  },
};

/** Install global error + unhandled rejection handlers (browser-only). */
let installed = false;
export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    observability.error("window", event.message ?? "Unhandled error", {
      filename: event.filename,
      line: event.lineno,
      col: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? reason.message : String(reason ?? "unknown");
    observability.error("promise", message);
  });
}
