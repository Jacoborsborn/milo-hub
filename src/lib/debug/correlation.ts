/**
 * Correlation ID for tracing a single generation attempt end-to-end.
 * Use in frontend logs, edge function body, edge logs, and content_json.metadata.
 * Disable audit logs via NEXT_PUBLIC_DEBUG_GENERATION=false (default).
 */

export const DEBUG_GENERATION =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DEBUG_GENERATION === "true";

/** Returns a short unique id (timestamp + random) for correlating logs. */
export function newCorrelationId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${t}-${r}`;
}
