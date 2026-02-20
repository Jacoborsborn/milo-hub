"use client";

import { useEffect, useState, useCallback } from "react";
import PricingCards from "@/components/billing/PricingCards";

type Profile = {
  subscription_status: string;
  subscription_tier: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  cancel_at_period_end: boolean | null;
  cancel_effective_at: string | null;
  current_period_end: string | null;
};

const CANCELLATION_REASONS = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "missing_features", label: "Missing features" },
  { value: "bugs", label: "Bugs / Not working" },
  { value: "not_using", label: "Not using it" },
  { value: "switching_tool", label: "Switching tool" },
  { value: "other", label: "Other" },
] as const;

type Toast = { id: number; message: string; type: "success" | "error" };

type Tier = "starter" | "pro" | "elite";

const TIERS: Array<{
  tier: Tier;
  name: string;
  price: string;
  subtitle: string;
  bullets: string[];
  highlight?: boolean;
}> = [
  {
    tier: "starter",
    name: "Starter",
    price: "£29/mo",
    subtitle: "For solo PTs validating their offer",
    bullets: [
      "Generate structured meal + workout plans",
      "Up to 10 active clients",
      "Client-ready share links",
      "Clean professional delivery",
      "Ideal for early-stage PTs",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: "£49/mo",
    subtitle: "For scaling coaches",
    bullets: [
      "Up to 30 active clients",
      "Advanced presets & customisation",
      "Template library for reuse",
      "Faster generation priority",
      "Built for growing online coaches",
    ],
    highlight: true,
  },
  {
    tier: "elite",
    name: "Elite",
    price: "£99/mo",
    subtitle: "For high-volume coaches & agencies",
    bullets: [
      "Up to 100 active clients",
      "Higher-volume generation intent",
      "Agency-ready workflow",
      "Priority support (planned)",
      "Automation tools (planned)",
    ],
  },
];

let toastId = 0;

export default function BillingPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoadingTier, setCheckoutLoadingTier] = useState<Tier | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cancelModalStep, setCancelModalStep] = useState<1 | 2 | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelDetails, setCancelDetails] = useState<string>("");
  const [cancelFeedbackId, setCancelFeedbackId] = useState<string | null>(null);
  const [cancelStepLoading, setCancelStepLoading] = useState(false);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const fetchProfile = useCallback(
    () =>
      fetch("/api/billing/profile")
        .then((res) => (res.ok ? res.json() : Promise.resolve(null)))
        .then((data) => setProfile(data ?? null)),
    []
  );

  useEffect(() => {
    fetchProfile()
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, [fetchProfile]);

  const startCheckout = async (tier: Tier) => {
    try {
      setCheckoutLoadingTier(tier);

      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });

      const data = await res.json();

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      alert(data?.error || "Unable to start checkout.");
      setCheckoutLoadingTier(null);
    } catch {
      alert("Checkout failed.");
      setCheckoutLoadingTier(null);
    }
  };

  const openCancelModal = () => {
    setCancelError(null);
    setCancelModalStep(1);
    setCancelReason("");
    setCancelDetails("");
    setCancelFeedbackId(null);
  };

  const closeCancelModal = () => {
    if (!cancelStepLoading) {
      setCancelModalStep(null);
      setCancelReason("");
      setCancelDetails("");
      setCancelFeedbackId(null);
    }
  };

  const submitCancelReason = async () => {
    if (!cancelReason || !profile) return;
    setCancelStepLoading(true);
    try {
      const res = await fetch("/api/billing/cancellation-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: cancelReason,
          details: cancelDetails.trim() || null,
          stripe_subscription_id: profile.stripe_subscription_id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data?.error ?? "Failed to save.", "error");
        return;
      }
      setCancelFeedbackId(data.feedbackId);
      setCancelModalStep(2);
    } catch {
      addToast("Request failed. Please try again.", "error");
    } finally {
      setCancelStepLoading(false);
    }
  };

  const cancelAtPeriodEnd = async () => {
    setCancelError(null);
    setCancelLoading(true);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "period_end", feedbackId: cancelFeedbackId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data?.error ?? "Cancellation failed.");
        addToast(data?.error ?? "Cancellation failed.", "error");
        return;
      }
      addToast("Cancellation scheduled. You’ll have access until the end of your trial/period.", "success");
      setCancelModalStep(null);
      await fetchProfile();
    } catch {
      addToast("Request failed. Please try again.", "error");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleExitOfferApply = async () => {
    setCancelStepLoading(true);
    try {
      const res = await fetch("/api/billing/exit-offer-50", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId: cancelFeedbackId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data?.error ?? "Failed to apply offer.", "error");
        return;
      }
      addToast("50% off applied. Your next invoice will be discounted.", "success");
      setCancelModalStep(null);
      await fetchProfile();
    } catch {
      addToast("Request failed. Please try again.", "error");
    } finally {
      setCancelStepLoading(false);
    }
  };

  const handleExitOfferContinueCancelling = async () => {
    await cancelAtPeriodEnd();
  };

  const resumeSubscription = async () => {
    setCancelError(null);
    setResumeLoading(true);
    try {
      const res = await fetch("/api/billing/resume", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data?.error ?? "Failed to resume.");
        addToast(data?.error ?? "Failed to resume.", "error");
        return;
      }
      addToast("Subscription resumed.", "success");
      await fetchProfile();
    } catch {
      addToast("Request failed. Please try again.", "error");
    } finally {
      setResumeLoading(false);
    }
  };

  const refreshBillingStatus = async () => {
    setRefreshLoading(true);
    try {
      const res = await fetch("/api/billing/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok && data?.error) {
        addToast(data.error, "error");
        return;
      }
      if (res.ok && data.synced) addToast("Billing status refreshed.", "success");
      await fetchProfile();
    } catch {
      addToast("Refresh failed.", "error");
    } finally {
      setRefreshLoading(false);
    }
  };

  if (loading) return <div style={{ padding: "0 0 24px" }}>Loading billing...</div>;
  if (!profile) return <div style={{ padding: "0 0 24px" }}>Unable to load billing data.</div>;

  const {
    subscription_status,
    subscription_tier,
    trial_ends_at,
    stripe_subscription_id,
    cancel_at_period_end,
    cancel_effective_at,
    current_period_end,
  } = profile;

  const isCanceled = subscription_status === "canceled";
  const isScheduled = Boolean(cancel_at_period_end) && !isCanceled;
  /** Trial or active both count as "has subscription" for UI (Stripe trialing → profile "trial"). */
  const isActiveOrTrial =
    subscription_status === "active" || subscription_status === "trial";
  const isTrialActive =
    subscription_status === "trial" &&
    !!trial_ends_at &&
    new Date(trial_ends_at) > new Date();
  const canCancel =
    Boolean(stripe_subscription_id?.trim()) &&
    isActiveOrTrial &&
    !isCanceled &&
    !isScheduled;
  const cancelEffectiveDate = cancel_effective_at || (isScheduled && trial_ends_at) || current_period_end;

  const statusColor = isCanceled
    ? "#dc3545"
    : subscription_status === "active"
      ? "#28a745"
      : subscription_status === "trial"
        ? "#f0ad4e"
        : "#dc3545";

  const statusLabel = isCanceled
    ? "CANCELLED"
    : isScheduled
      ? "CANCELLATION SCHEDULED"
      : subscription_status.toUpperCase();

  return (
    <div style={{ padding: "0 0 24px", maxWidth: 1000 }}>
      <div
        style={{
          marginTop: 0,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 8,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Current Plan</h2>
        <p>
          <strong>Status: </strong>
          <span style={{ color: statusColor, fontWeight: "bold" }}>{statusLabel}</span>
        </p>

        {subscription_tier && (
          <p>
            <strong>Tier:</strong> {subscription_tier}
          </p>
        )}

        {subscription_status === "trial" && trial_ends_at && (
          <>
            <p>
              <strong>Trial Ends:</strong> {new Date(trial_ends_at).toLocaleDateString()}
            </p>
            {isTrialActive && (
              <p style={{ color: "#555", fontSize: 14, marginTop: 4 }}>
                Trial active until {new Date(trial_ends_at).toLocaleDateString()}. Billing will start automatically when trial ends (unless canceled).
              </p>
            )}
          </>
        )}

        {isScheduled && current_period_end && (
          <p>
            <strong>Access until:</strong> {new Date(current_period_end).toLocaleDateString()}
          </p>
        )}

        {cancelError && (
          <p style={{ color: "#dc3545", marginTop: 8 }}>{cancelError}</p>
        )}

        {/* Manage row */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #eee" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Manage</h3>
          {stripe_subscription_id?.trim() && !isCanceled && (
            <>
              {canCancel && (
                <button
                  type="button"
                  onClick={openCancelModal}
                  disabled={cancelLoading}
                  style={{
                    padding: "8px 14px",
                    background: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: cancelLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {cancelLoading ? "Processing…" : "Cancel subscription"}
                </button>
              )}
              {isScheduled && (
                <>
                  <p style={{ margin: "8px 0", fontSize: 14, color: "#555" }}>
                    Cancellation scheduled for {cancelEffectiveDate ? new Date(cancelEffectiveDate).toLocaleDateString() : "—"}
                  </p>
                  <button
                    type="button"
                    onClick={resumeSubscription}
                    disabled={resumeLoading}
                    style={{
                      padding: "8px 14px",
                      background: "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: resumeLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {resumeLoading ? "Processing…" : "Resume subscription"}
                  </button>
                </>
              )}
            </>
          )}
          {!stripe_subscription_id?.trim() && !isCanceled && isActiveOrTrial && (
            <>
              <p style={{ color: "#555", fontSize: 14, marginBottom: 8 }}>
                {isTrialActive
                  ? "Trial is active. Use Refresh to sync with Stripe if needed."
                  : "Subscription active. Use Refresh to sync with Stripe if needed."}
              </p>
              <button
                type="button"
                onClick={refreshBillingStatus}
                disabled={refreshLoading}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  background: "#f0f0f0",
                  color: "#333",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  cursor: refreshLoading ? "not-allowed" : "pointer",
                }}
              >
                {refreshLoading ? "Refreshing…" : "Refresh billing status"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Toast list */}
      {toasts.length > 0 && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 60, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                padding: "12px 20px",
                borderRadius: 8,
                background: t.type === "success" ? "#28a745" : "#dc3545",
                color: "white",
                fontSize: 14,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Cancel flow modal (reason → exit offer) */}
      {cancelModalStep !== null && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50 }}
            aria-hidden
            onClick={closeCancelModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={cancelModalStep === 1 ? "cancel-reason-title" : "exit-offer-title"}
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 51,
              background: "white",
              borderRadius: 12,
              padding: 24,
              maxWidth: 420,
              width: "90%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            {cancelModalStep === 1 && (
              <>
                <h2 id="cancel-reason-title" style={{ margin: "0 0 12px", fontSize: 18 }}>
                  Why are you cancelling?
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                  {CANCELLATION_REASONS.map((r) => (
                    <label key={r.value} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="cancelReason"
                        value={r.value}
                        checked={cancelReason === r.value}
                        onChange={() => setCancelReason(r.value)}
                      />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>
                {cancelReason === "other" && (
                  <textarea
                    placeholder="Optional details"
                    value={cancelDetails}
                    onChange={(e) => setCancelDetails(e.target.value)}
                    rows={3}
                    style={{ width: "100%", marginBottom: 16, padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
                  />
                )}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" onClick={closeCancelModal} disabled={cancelStepLoading} style={{ padding: "8px 14px", background: "#eee", border: "none", borderRadius: 6, cursor: cancelStepLoading ? "not-allowed" : "pointer" }}>
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={submitCancelReason}
                    disabled={!cancelReason || cancelStepLoading}
                    style={{ padding: "8px 14px", background: "#0070f3", color: "white", border: "none", borderRadius: 6, cursor: !cancelReason || cancelStepLoading ? "not-allowed" : "pointer" }}
                  >
                    {cancelStepLoading ? "Saving…" : "Continue"}
                  </button>
                </div>
              </>
            )}
            {cancelModalStep === 2 && (
              <>
                <h2 id="exit-offer-title" style={{ margin: "0 0 12px", fontSize: 18 }}>
                  Get 50% off your next month
                </h2>
                <p style={{ margin: "0 0 20px", color: "#555", fontSize: 14 }}>
                  We’d hate to see you go. Keep your plan and get 50% off your next invoice (one-time).
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    type="button"
                    onClick={handleExitOfferApply}
                    disabled={cancelStepLoading}
                    style={{
                      padding: "12px 16px",
                      background: "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      cursor: cancelStepLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {cancelStepLoading ? "Applying…" : "Apply 50% off and keep my plan"}
                  </button>
                  <button
                    type="button"
                    onClick={handleExitOfferContinueCancelling}
                    disabled={cancelLoading || cancelStepLoading}
                    style={{
                      padding: "12px 16px",
                      background: "transparent",
                      color: "#666",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      cursor: cancelLoading || cancelStepLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {cancelLoading ? "Processing…" : "No thanks, continue cancelling"}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-neutral-900">Plans</h2>
        <p className="mt-1.5 text-sm text-neutral-500">
          3-day free trial included. Cancel anytime.
        </p>
        <div className="mt-6">
          <PricingCards
            tiers={TIERS}
            currentTier={subscription_tier}
            subscriptionStatus={subscription_status}
            onSelectTier={startCheckout}
            loadingTier={checkoutLoadingTier}
          />
        </div>
      </section>
    </div>
  );
}
