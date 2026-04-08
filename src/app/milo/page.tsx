 "use client";

import Head from "next/head";
import Link from "next/link";

export default function MiloLandingPage() {
  return (
    <>
      <Head>
        <title>Milo+ | AI-Powered Fitness Plans</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <link rel="stylesheet" href="/milo/styles.css" />
      </Head>

      {/* HERO SECTION */}
      <section className="hero">
        <div className="container">
          <h1>Your Personalized Fitness Plan in 60 Seconds</h1>
          <p className="subtitle">
            Custom meal plans, tailored workouts, and grocery lists—designed for your body and
            goals.
          </p>

          <a
            id="checkout-button"
            href="/milo/signup"
            className="cta-button"
          >
            Start 7-Day Free Trial
          </a>
          <p className="cta-subtext">No charge today · Cancel anytime</p>

          <div className="social-proof">
            <span className="stars">⭐⭐⭐⭐⭐</span>
            <span className="rating">4.9/5 · 100+ users</span>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="features">
        <div className="container">
          <h2>One App. One System.</h2>

          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-icon">📅</div>
              <div className="feature-text">
                <h3>Full Weekly Plans</h3>
                <p>Complete workouts and meals for your week.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">🛒</div>
              <div className="feature-text">
                <h3>Grocery Prices</h3>
                <p>UK supermarket costs included.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">📖</div>
              <div className="feature-text">
                <h3>Easy Recipes</h3>
                <p>Simple instructions for every meal.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">🎯</div>
              <div className="feature-text">
                <h3>Accurate Macros</h3>
                <p>Hit your nutrition targets daily.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">🍽️</div>
              <div className="feature-text">
                <h3>Unique Meals</h3>
                <p>Personalized to your preferences.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">📝</div>
              <div className="feature-text">
                <h3>Shopping List</h3>
                <p>All ingredients automatically added.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-it-works">
        <div className="container">
          <h2>How It Works</h2>

          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Answer 3 Questions</h3>
              <p>Fitness level, diet, and equipment.</p>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <h3>Get Your Plan</h3>
              <p>AI generates everything instantly.</p>
            </div>

            <div className="step">
              <div className="step-number">3</div>
              <h3>Start Today</h3>
              <p>Follow your plan and track progress.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-cta">
        <div className="container">
          <h2>Start Your Free Trial</h2>
          <p className="subtitle">7 days free. No charge today.</p>

          <a
            id="checkout-button-2"
            href="/milo/signup"
            className="cta-button"
          >
            Try Milo+ Free for 7 Days
          </a>

          <p className="pricing-note">Then £7.99/month · Cancel anytime</p>

          <div className="trust-badges">
            <span>🔒 Secure Payment</span>
            <span>✅ No Commitment</span>
            <span>📱 iOS &amp; Web</span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <p>© 2025 Milo+. All rights reserved.</p>
        <div style={{ marginTop: "8px", fontSize: "12px" }}>
          <Link href="/privacy">Privacy</Link>
          <span style={{ margin: "0 4px" }}>·</span>
          <Link href="/terms">Terms</Link>
        </div>
      </footer>
    </>
  );
}

