"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PlanRenderer from "@/components/PlanRenderer";
import PrintTrigger from "./PrintTrigger";
import { getBrandLogoUrl } from "@/lib/branding";

interface Plan {
  id: string;
  client_id: string;
  plan_type: "meal" | "workout";
  content_json: Record<string, unknown>;
  created_at: string;
  client_name?: string | null;
}

export default function PlanPrintPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [profile, setProfile] = useState<{ brand_logo_url?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    params.then((p) => {
      setPlanId(p.planId);
      Promise.all([
        fetch(`/api/plans/${p.planId}`).then((res) => {
          if (!res.ok) throw new Error("Failed to load plan");
          return res.json();
        }),
        fetch("/api/billing/profile").then((res) => (res.ok ? res.json() : null)),
      ])
        .then(([planData, profileData]) => {
          if (!cancelled) {
            setPlan(planData);
            setProfile(profileData);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load plan");
            setLoading(false);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  if (loading) {
    return (
      <div className="print-plan-page">
        <p>Loading plan…</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="print-plan-page">
        <p style={{ color: "#c00" }}>{error || "Plan not found"}</p>
        <button type="button" onClick={() => router.back()}>
          Go back
        </button>
      </div>
    );
  }

  const planTypeLabel =
    plan.plan_type.charAt(0).toUpperCase() + plan.plan_type.slice(1);
  const createdDate = new Date(plan.created_at).toLocaleDateString(undefined, {
    dateStyle: "long",
  });
  const brandLogoUrl = getBrandLogoUrl(profile);

  return (
    <div className="print-plan-page">
      <PrintTrigger ready={!!plan} />
      <header className="print-plan-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <img
          src={brandLogoUrl}
          alt=""
          style={{ height: "28px", width: "auto", maxWidth: "140px", objectFit: "contain" }}
        />
        <div className="print-plan-meta" style={{ textAlign: "right" }}>
          {plan.client_name && (
            <div className="print-plan-client" style={{ fontWeight: 600, marginBottom: "2px" }}>{plan.client_name}</div>
          )}
          <span>{planTypeLabel} Plan</span>
          <span style={{ marginLeft: "12px" }}>Created: {createdDate}</span>
        </div>
      </header>
      <div className="print-plan-content">
        <PlanRenderer plan={plan.content_json} />
      </div>
      <footer className="print-plan-footer" style={{ marginTop: "24px", paddingTop: "12px", borderTop: "1px solid #ddd", fontSize: "12px", color: "#666" }}>
        Powered by Milo Hub
      </footer>
    </div>
  );
}

