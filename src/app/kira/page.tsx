"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bebas_Neue, DM_Sans } from "next/font/google";
import "./kira.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--kira-font-bebas",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--kira-font-dm-sans",
  display: "swap",
});

type Plan = "monthly" | "bundle";
type SubmitState = "idle" | "loading" | "success" | "error";

export default function KiraPage() {
  return (
    <Suspense>
      <KiraPageInner />
    </Suspense>
  );
}

function KiraPageInner() {
  const [plan, setPlan] = useState<Plan>("bundle");
  const [goal, setGoal] = useState("");
  const [fitness, setFitness] = useState("");
  const [days, setDays] = useState("");
  const [equipment, setEquipment] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const searchParams = useSearchParams();
  const appliedViaStripe = searchParams.get("applied") === "true";

  const includeRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll-reveal for include items
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.08 }
    );
    includeRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitState("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);

    const payload = {
      name: data.get("name") as string,
      age: parseInt(data.get("age") as string, 10),
      country: data.get("country") as string,
      email: data.get("email") as string,
      instagram: (data.get("instagram") as string) || null,
      plan_selected: plan,
      goal: goal || null,
      fitness_level: fitness || null,
      days_per_week: days || null,
      equipment: equipment || null,
      injuries: (data.get("injuries") as string) || null,
      referral_source: (data.get("referral_source") as string) || null,
      notes: (data.get("notes") as string) || null,
    };

    try {
      // 1. Insert lead into Supabase
      const leadsRes = await fetch("/api/kira/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!leadsRes.ok) {
        const err = await leadsRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit application.");
      }

      const { lead_id } = await leadsRes.json();

      // 2. Create Stripe checkout session
      const checkoutRes = await fetch("/api/kira/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, lead_id }),
      });

      if (!checkoutRes.ok) {
        const err = await checkoutRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create checkout session.");
      }

      const { url } = await checkoutRes.json();
      window.location.href = url;
    } catch (err) {
      setSubmitState("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const includes = [
    { num: "01", title: "Custom workout plan", desc: "Built around your schedule, equipment, and goal. Not a template — yours." },
    { num: "02", title: "Full meal plan", desc: "Flexible, practical, fits real life. No obsessive tracking unless you want it." },
    { num: "03", title: "Shopping list", desc: "Ready to go. Nothing complicated. No weird ingredients." },
    { num: "04", title: "Macros + recipes", desc: "Your numbers, your meals. Actual food that doesn't taste like cardboard." },
    { num: "05", title: "Weekly email check-ins", desc: "Every single week. You update me, I adjust. The plan moves with you." },
    { num: "06", title: "Programme adjustments", desc: "Life happens. Weeks get missed. We don't restart — we adapt." },
  ];

  return (
    <div className={`kira-root ${bebasNeue.variable} ${dmSans.variable}`}>
      {/* Noise overlay */}
      <div className="kira-noise" aria-hidden="true" />

      {/* ── HERO ── */}
      <section className="hero">
        <div className="launch-badge">⚡ Launch Pricing</div>
        <div className="hero-left">
          <h1>
            KIRA<span>MEI.</span>
          </h1>
          <p className="hero-sub">
            Custom programme. Real check-ins. No fluff, no fads.
            Just you, a plan that actually fits your life, and someone who holds you to it.
          </p>
          <a href="#apply" className="hero-cta">APPLY NOW</a>
        </div>
        <div className="hero-right">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kira/kira-hero.jpg" alt="Kira Mei" />
        </div>
      </section>

      {/* ── STATS ── */}
      <div className="stats">
        <div className="stat">
          <div className="stat-num">100%</div>
          <div className="stat-label">Online</div>
        </div>
        <div className="stat">
          <div className="stat-num">Custom</div>
          <div className="stat-label">Every Programme</div>
        </div>
        <div className="stat">
          <div className="stat-num">Weekly</div>
          <div className="stat-label">Check-ins</div>
        </div>
        <div className="stat">
          <div className="stat-num">Global</div>
          <div className="stat-label">Clients Welcome</div>
        </div>
      </div>

      {/* ── WHAT'S INCLUDED ── */}
      <section className="section">
        <div className="section-label">Everything that&apos;s included</div>
        <div className="includes-grid">
          {includes.map((item, i) => (
            <div
              key={item.num}
              className="include-item"
              ref={(el) => { includeRefs.current[i] = el; }}
            >
              <div className="include-num">{item.num}</div>
              <div className="include-content">
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="section">
        <div className="section-label">Pricing</div>
        <div className="pricing-grid">
          <div className="price-card">
            <div className="price-plan">Monthly</div>
            <div className="price-amount">£99<span>.99/mo</span></div>
            <div className="price-per">Billed monthly · Cancel anytime</div>
            <ul className="price-features">
              <li>Custom workout plan</li>
              <li>Full meal plan + shopping list</li>
              <li>Macros + recipes</li>
              <li>Weekly email check-ins</li>
              <li>Programme adjustments</li>
            </ul>
          </div>
          <div className="price-card featured">
            <div className="price-badge">BEST VALUE</div>
            <div className="price-plan">2-Month Bundle</div>
            <div className="price-amount">£149<span>.99</span></div>
            <div className="price-per">One payment · 2 months included</div>
            <div className="price-saving">You save £50 vs monthly</div>
            <ul className="price-features">
              <li>Everything in monthly</li>
              <li>Priority application review</li>
              <li>2 full months of support</li>
              <li>Best results start here</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── FORM ── */}
      <section className="form-section" id="apply">
        {submitState !== "success" && !appliedViaStripe ? (
          <>
            <div className="form-intro">
              <div className="section-label">Client intake</div>
              <h2>APPLY<br />FOR A<br />SPOT.</h2>
              <p>
                I review every application personally. If we&apos;re a good fit I&apos;ll email you
                within 48 hours with next steps. Be honest — the more I know, the better I can help.
              </p>
            </div>

            <form className="form" onSubmit={handleSubmit}>
              <div className="field">
                <label>Full name</label>
                <input name="name" type="text" placeholder="Your name" required />
              </div>

              <div className="field">
                <label>Age</label>
                <input name="age" type="number" placeholder="e.g. 42" min={16} max={99} required />
              </div>

              <div className="field">
                <label>Country</label>
                <input name="country" type="text" placeholder="Where are you based?" required />
              </div>

              <div className="field">
                <label>Email address</label>
                <input name="email" type="email" placeholder="your@email.com" required />
              </div>

              <div className="field">
                <label>Instagram handle (optional)</label>
                <input name="instagram" type="text" placeholder="@yourhandle" />
              </div>

              <div className="field">
                <label>Which plan are you interested in?</label>
                <div className="plan-selector">
                  <button
                    type="button"
                    className={`plan-opt${plan === "monthly" ? " selected" : ""}`}
                    onClick={() => setPlan("monthly")}
                  >
                    <div className="plan-opt-name">Monthly</div>
                    <div className="plan-opt-price">£99.99</div>
                  </button>
                  <button
                    type="button"
                    className={`plan-opt${plan === "bundle" ? " selected" : ""}`}
                    onClick={() => setPlan("bundle")}
                  >
                    <div className="plan-opt-name">2-Month Bundle</div>
                    <div className="plan-opt-price">£149.99</div>
                    <div className="plan-opt-save">Save £50</div>
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Primary goal</label>
                <div className="options-grid">
                  {["Lose weight", "Build muscle", "More energy", "General fitness", "Confidence", "All of the above"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`option-btn${goal === opt ? " selected" : ""}`}
                      onClick={() => setGoal(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Current fitness level</label>
                <div className="options-grid">
                  {["Complete beginner", "Some experience", "Train occasionally", "Train regularly"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`option-btn${fitness === opt ? " selected" : ""}`}
                      onClick={() => setFitness(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Days per week you can commit</label>
                <div className="options-grid">
                  {["2 days", "3 days", "4 days", "5+ days"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`option-btn${days === opt ? " selected" : ""}`}
                      onClick={() => setDays(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Equipment access</label>
                <div className="options-grid">
                  {["Gym membership", "Home gym", "Dumbbells only", "No equipment"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`option-btn${equipment === opt ? " selected" : ""}`}
                      onClick={() => setEquipment(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Injuries or health conditions</label>
                <textarea name="injuries" placeholder="Be specific — or type 'none'" />
              </div>

              <div className="field">
                <label>How did you find me?</label>
                <select name="referral_source" defaultValue="">
                  <option value="" disabled>Select one</option>
                  <option>Instagram</option>
                  <option>TikTok</option>
                  <option>Threads</option>
                  <option>X (Twitter)</option>
                  <option>Word of mouth</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="field">
                <label>Anything else you want me to know?</label>
                <textarea name="notes" placeholder="Use this. The more honest you are, the better." />
              </div>

              <div className="submit-area">
                <p className="submit-note">
                  <strong>What happens next:</strong> I review every application personally.
                  If we&apos;re a good fit I&apos;ll email you within 48 hours.
                  No spam. No sales calls. Just a straight answer.
                </p>
                {submitState === "error" && (
                  <p className="submit-error">{errorMsg}</p>
                )}
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={submitState === "loading"}
                >
                  {submitState === "loading" ? "SENDING..." : "SEND MY APPLICATION"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div id="apply" className="success-screen visible">
            <div className="success-tag">✓ Application received</div>
            <h2>GOT<br />IT.</h2>
            <p>
              I&apos;ll review your application and email you within 48 hours.<br /><br />
              Don&apos;t message asking if I got it. I did.
            </p>
          </div>
        )}
      </section>

      <footer>
        <span className="footer-name">KIRA MEI</span>
        <span>Online PT · Worldwide · Launch Pricing 2025</span>
      </footer>
    </div>
  );
}
