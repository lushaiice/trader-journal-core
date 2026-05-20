import * as Sentry from "@sentry/browser";

let initialised = false;

export function initialiseSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || initialised) return;
  initialised = true;

  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_APP_ENV as string | undefined) ?? "development",
    // Only send errors — no performance tracing, no session replay, no profiling.
    // These introduce user-behaviour telemetry that conflicts with the product's privacy posture.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Never send financial or identity data. The observability layer already
    // redacts these before they reach any sink, but belt-and-suspenders here.
    beforeSend(event) {
      return event;
    },
  });
}

export function sentryCapture(error: unknown, context?: Record<string, string>): void {
  if (!initialised) return;
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([k, v]) => scope.setTag(k, v));
    }
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  });
}
