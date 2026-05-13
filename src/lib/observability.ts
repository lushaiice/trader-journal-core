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

/**
 * Coarse categories for grouping errors in logs and dashboards.
 * Keep this list short and stable — categorization is for triage,
 * not for fine-grained product analytics.
 */
export type ObservabilityCategory =
  | "auth"
  | "network"
  | "analytics"
  | "storage"
  | "validation"
  | "render"
  | "unknown";

export interface ObservabilityEvent {
  level: ObservabilityLevel;
  scope: string;
  category: ObservabilityCategory;
  message: string;
  meta?: Record<string, unknown>;
  env: string;
  at: string;
}

function currentEnv(): string {
  try {
    // Vite client
    const v = (import.meta as { env?: Record<string, string> }).env;
    if (v?.VITE_APP_ENV) return v.VITE_APP_ENV;
    if (v?.MODE) return v.MODE;
  } catch {
    /* ignore */
  }
  if (typeof process !== "undefined" && process.env?.NODE_ENV) {
    return process.env.NODE_ENV;
  }
  return "unknown";
}

function isProd(env: string): boolean {
  return env === "production" || env === "prod";
}

function inferCategory(scope: string, message: string): ObservabilityCategory {
  const s = `${scope} ${message}`.toLowerCase();
  if (/auth|login|session|token|signin|signup/.test(s)) return "auth";
  if (/network|fetch|http|timeout|offline|cors/.test(s)) return "network";
  if (/storage|upload|bucket|file/.test(s)) return "storage";
  if (/validation|schema|zod|invalid|parse/.test(s)) return "validation";
  if (/analytics|metric|chart|equity|drawdown/.test(s)) return "analytics";
  if (/render|component|react|hydrate|route/.test(s)) return "render";
  return "unknown";
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

export interface TrackOptions {
  category?: ObservabilityCategory;
  meta?: Record<string, unknown>;
}

export function track(
  level: ObservabilityLevel,
  scope: string,
  message: string,
  optsOrMeta?: TrackOptions | Record<string, unknown>,
) {
  const opts: TrackOptions =
    optsOrMeta && ("category" in optsOrMeta || "meta" in optsOrMeta)
      ? (optsOrMeta as TrackOptions)
      : { meta: optsOrMeta as Record<string, unknown> | undefined };

  const env = currentEnv();
  const event: ObservabilityEvent = {
    level,
    scope,
    category: opts.category ?? inferCategory(scope, message),
    message,
    meta: opts.meta ? (redact(opts.meta) as Record<string, unknown>) : undefined,
    env,
    at: new Date().toISOString(),
  };
  ring.push(event);
  if (ring.length > RING_LIMIT) ring.shift();

  // In production, only warn/error reach the console — keep it calm.
  if (isProd(env) && level === "info") return;

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
