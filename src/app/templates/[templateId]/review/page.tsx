"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function ReviewPlanPage() {
  const params = useParams<{ templateId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateId = params.templateId;
  const clientId = searchParams.get("client_id");

  const [plan, setPlan] = useState<any>(null);

  useEffect(() => {
    if (templateId && clientId) {
      try {
        const stored = sessionStorage.getItem(`plan_${templateId}_${clientId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setPlan(parsed);
        } else {
          alert("No plan data found. Please generate a new draft.");
          router.push(`/templates/${templateId}/assign`);
        }
      } catch (err) {
        console.error("Failed to parse plan:", err);
        alert("Invalid plan data");
        router.push(`/templates/${templateId}/assign`);
      }
    }
  }, [templateId, clientId, router]);

  if (!plan) {
    return <div style={{ padding: 24 }}>Loading plan...</div>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: "40px auto", padding: "0 24px" }}>
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push(`/templates/${templateId}/assign?client_id=${clientId}`)}>
          ← Back
        </button>
      </div>

      <h1>Review Plan Draft</h1>
      <p style={{ opacity: 0.8, marginBottom: 24 }}>
        Program ID: <code>{templateId}</code> | Client ID: <code>{clientId}</code>
      </p>

      <div style={{ marginBottom: 32 }}>
        <h2>Plan Summary</h2>
        <p>
          <strong>Duration:</strong> {plan.duration_weeks} weeks
        </p>
        <p>
          <strong>Generated:</strong> {new Date(plan.generated_at).toLocaleString()}
        </p>
        <p>
          <strong>Phases:</strong> {plan.phases?.length || 0}
        </p>
        <p>
          <strong>Total Weeks:</strong> {plan.weeks?.length || 0}
        </p>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2>Raw JSON</h2>
        <textarea
          readOnly
          value={JSON.stringify(plan, null, 2)}
          style={{
            width: "100%",
            minHeight: "600px",
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: 12,
            lineHeight: 1.5,
            resize: "vertical",
          }}
        />
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
        <button
          onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(plan, null, 2));
            alert("Plan JSON copied to clipboard!");
          }}
        >
          Copy JSON
        </button>
        <button
          onClick={() => {
            alert("Next: Save to plans table");
          }}
        >
          Save Plan
        </button>
        <button onClick={() => router.push(`/templates/${templateId}/assign?client_id=${clientId}`)}>
          Back to Assign
        </button>
      </div>
    </div>
  );
}
