"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveDraftPlanAction, setAssignedWorkoutAsDefaultAction } from "./actions";
import { supabase } from "../../../lib/supabase/browser";
import PlanRenderer from "@/components/PlanRenderer";
import { DEBUG_GENERATION } from "@/lib/debug/correlation";

type SaveState = "idle" | "saving" | "success" | "error";

type DraftDebug = {
  correlationId: string | null;
  requestPayload: unknown;
  rawResponse: unknown;
  draftForRender: unknown;
};

export default function PlanReviewPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<DraftDebug | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saveAsDefaultDismissed, setSaveAsDefaultDismissed] = useState(false);
  const [savingAsDefault, setSavingAsDefault] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("pt_plan_draft");
    if (!raw) {
      router.push("/templates");
      return;
    }
    setDraft(JSON.parse(raw));
    const debugRaw = sessionStorage.getItem("pt_plan_draft_debug");
    if (debugRaw) {
      try {
        setDebugInfo(JSON.parse(debugRaw) as DraftDebug);
      } catch {
        setDebugInfo(null);
      }
    }
  }, [router]);

  const handleSave = async () => {
    if (!draft) {
      setErrorMessage("No draft plan found");
      setSaveState("error");
      return;
    }

    // Check for authenticated session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData.session) {
      const errorMsg = "You must be logged in to save a plan";
      console.error("[PlanReviewPage] Session error:", sessionError);
      setErrorMessage(errorMsg);
      setSaveState("error");
      return;
    }

    console.log("[PlanReviewPage] Saving plan:", {
      userId: sessionData.session.user.id,
      templateId: draft.template_id,
      clientId: draft.client_id,
      payloadKeys: Object.keys(draft),
    });

    setIsSaving(true);
    setSaveState("saving");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await saveDraftPlanAction(draft);
      setSaveState("success");
      setSuccessMessage("Plan saved successfully!");
      
      // Redirect to the saved plan page after a brief delay to show success message
      setTimeout(() => {
        router.push(`/pt/app/plans/${result.planId}`);
      }, 1000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to save plan";
      console.error("[PlanReviewPage] Save error:", err);
      setErrorMessage(errorMsg);
      setSaveState("error");
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!draft) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const showSaveAsDefault =
    draft?.client_id &&
    draft?.template_id &&
    !saveAsDefaultDismissed;

  const handleSaveAsDefault = async () => {
    if (!draft?.client_id || !draft?.template_id) return;
    setSavingAsDefault(true);
    try {
      await setAssignedWorkoutAsDefaultAction(draft.client_id, draft.template_id);
      setSaveAsDefaultDismissed(true);
    } catch (err) {
      console.error("[PlanReviewPage] Save as default error:", err);
    } finally {
      setSavingAsDefault(false);
    }
  };

  if (!draft) return <p style={{ padding: 24 }}>Loading...</p>;

  const coachMessage: string | null =
    typeof draft?.coachMessage === "string"
      ? draft.coachMessage
      : typeof draft?.metadata?.coachMessage === "string"
      ? draft.metadata.coachMessage
      : null;

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1>Plan Review (Draft)</h1>

      {coachMessage && (
        <div
          style={{
            padding: 12,
            background: "#fff7e6",
            color: "#7a4a00",
            borderRadius: 6,
            marginTop: 12,
            marginBottom: 16,
            border: "1px solid #ffe2b3",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Coach message</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{coachMessage}</div>
        </div>
      )}

      {showSaveAsDefault && (
        <div
          style={{
            padding: 12,
            background: "#e8f4fd",
            color: "#0c5460",
            borderRadius: 4,
            marginBottom: 16,
            border: "1px solid #b8daff",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span>Save this program as the new default workout for this client?</span>
          <span style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleSaveAsDefault}
              disabled={savingAsDefault}
              style={{
                padding: "6px 12px",
                background: "#0070f3",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: savingAsDefault ? "not-allowed" : "pointer",
              }}
            >
              {savingAsDefault ? "Saving..." : "Yes"}
            </button>
            <button
              type="button"
              onClick={() => setSaveAsDefaultDismissed(true)}
              style={{
                padding: "6px 12px",
                background: "transparent",
                color: "#0c5460",
                border: "1px solid #0c5460",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              No
            </button>
          </span>
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            padding: 12,
            background: "#fee",
            color: "#c00",
            borderRadius: 4,
            marginBottom: 16,
            border: "1px solid #fcc",
          }}
        >
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            padding: 12,
            background: "#efe",
            color: "#0a0",
            borderRadius: 4,
            marginBottom: 16,
            border: "1px solid #cfc",
          }}
        >
          <strong>✓ {successMessage}</strong> Redirecting...
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => router.push("/templates")}>Back</button>
        <button
          onClick={handleCopy}
          style={{
            padding: "8px 16px",
            background: copied ? "#28a745" : "#0070f3",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {copied ? "✓ Copied!" : "Copy JSON"}
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || saveState === "success"}
          style={{
            opacity: isSaving || saveState === "success" ? 0.6 : 1,
            cursor: isSaving || saveState === "success" ? "not-allowed" : "pointer",
            padding: "8px 16px",
            background: isSaving || saveState === "success" ? "#6c757d" : "#28a745",
            color: "white",
            border: "none",
            borderRadius: 4,
          }}
        >
          {isSaving
            ? "Saving..."
            : saveState === "success"
            ? "Saved"
            : "Confirm & Save (next)"}
        </button>
      </div>

      {DEBUG_GENERATION && debugInfo && (
        <div style={{ marginTop: 24, border: "1px solid #ccc", borderRadius: 8, overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => setDebugOpen((o) => !o)}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "#f5f5f5",
              border: "none",
              textAlign: "left",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Debug (generation audit) {debugOpen ? "▼" : "▶"}
          </button>
          {debugOpen && (
            <div style={{ padding: 16, background: "#fafafa", fontSize: 12, fontFamily: "monospace" }}>
              <p><strong>correlationId:</strong> {debugInfo.correlationId ?? "—"}</p>
              <p><strong>Last request payload:</strong></p>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200, overflow: "auto" }}>
                {JSON.stringify(debugInfo.requestPayload, null, 2)}
              </pre>
              <p><strong>Last response payload:</strong></p>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200, overflow: "auto" }}>
                {JSON.stringify(debugInfo.rawResponse, null, 2)}
              </pre>
              <p><strong>Last draft JSON used for rendering:</strong></p>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200, overflow: "auto" }}>
                {JSON.stringify(debugInfo.draftForRender, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <PlanRenderer plan={draft} />
      </div>
    </div>
  );
}
