"use client";

import { useEffect, useState } from "react";

type Profile = {
  subscription_status: string;
  subscription_tier: string | null;
  trial_ends_at: string | null;
};

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

export default function BillingPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoadingTier, setCheckoutLoadingTier] = useState<Tier | null>(null);

  useEffect(() => {
    fetch("/api/billing/profile")
      .then((res) => (res.ok ? res.json() : Promise.resolve(null)))
      .then((data) => {
        setProfile(data ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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

  if (loading) return <div style={{ padding: "0 0 24px" }}>Loading billing...</div>;
  if (!profile) return <div style={{ padding: "0 0 24px" }}>Unable to load billing data.</div>;

  const { subscription_status, subscription_tier, trial_ends_at } = profile;

  const statusColor =
    subscription_status === "active" ? "#28a745" : subscription_status === "trial" ? "#f0ad4e" : "#dc3545";

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
          <span style={{ color: statusColor, fontWeight: "bold" }}>{subscription_status.toUpperCase()}</span>
        </p>

        {subscription_tier && (
          <p>
            <strong>Tier:</strong> {subscription_tier}
          </p>
        )}

        {subscription_status === "trial" && trial_ends_at && (
          <p>
            <strong>Trial Ends:</strong> {new Date(trial_ends_at).toLocaleDateString()}
          </p>
        )}
      </div>

      <div style={{ marginTop: 40 }}>
        <h2>Plans</h2>
        <p style={{ color: "#666", marginTop: 6 }}>
          3-day free trial included. Cancel anytime.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 20 }}>
          {TIERS.map((t) => (
            <div
              key={t.tier}
              style={{
                border: t.highlight ? "2px solid #0070f3" : "1px solid #ddd",
                borderRadius: 10,
                padding: 18,
              }}
            >
              {t.highlight && (
                <div style={{ fontSize: 12, color: "#0070f3", fontWeight: "bold", marginBottom: 8 }}>
                  MOST POPULAR
                </div>
              )}

              <div style={{ fontSize: 18, fontWeight: "bold" }}>{t.name}</div>
              <div style={{ fontSize: 22, marginTop: 6 }}>{t.price}</div>
              <div style={{ marginTop: 6, color: "#666", fontSize: 13 }}>{t.subtitle}</div>

              <ul style={{ marginTop: 14, paddingLeft: 18, color: "#333", fontSize: 13 }}>
                {t.bullets.map((b) => (
                  <li key={b} style={{ marginBottom: 6 }}>
                    {b}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => startCheckout(t.tier)}
                disabled={checkoutLoadingTier !== null || subscription_status === "active"}
                style={{
                  marginTop: 14,
                  width: "100%",
                  padding: "10px 12px",
                  background: subscription_status === "active" ? "#999" : "#0070f3",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: subscription_status === "active" ? "not-allowed" : "pointer",
                }}
              >
                {subscription_status === "active"
                  ? "Already Active"
                  : checkoutLoadingTier === t.tier
                  ? "Redirecting..."
                  : `Start ${t.name}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
