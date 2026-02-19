export default function MarketingHomePage() {
  return (
    <main className="bg-white text-black">
      {/* 1. HERO SECTION */}
      <section
        className="mx-auto max-w-[1200px] px-6 py-24 grid grid-cols-1 md:grid-cols-2 gap-16 items-center"
        style={{
          background: "linear-gradient(180deg, #ffffff 0%, #f7f9fc 100%)",
        }}
      >
        <div>
          <div
            className="mb-4 w-fit rounded-full px-3 py-1.5 uppercase text-[12px] font-normal"
            style={{
              letterSpacing: "0.08em",
              background: "#eef2f7",
              color: "#334155",
            }}
          >
            Built for independent coaches
          </div>
          <h1 className="max-w-[600px]" style={{ fontSize: "56px", lineHeight: 1.1 }}>
            <span style={{ fontWeight: 700 }}>Build client plans in minutes.</span>
            <br />
            <span style={{ fontWeight: 500 }}>Deliver them with structure.</span>
          </h1>
          <p
            className="mt-5 max-w-[520px]"
            style={{ fontSize: "18px", lineHeight: 1.6, color: "#475569" }}
          >
            Milo Hub helps independent coaches generate structured workout plans
            fast — without losing control of their programming.
          </p>
          <div className="mt-8 flex gap-4">
            <a
              href="/signup"
              className="inline-flex items-center justify-center rounded-[10px] px-6 font-semibold text-white h-12"
              style={{
                background: "#2563eb",
                boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
              }}
            >
              Start free trial
            </a>
            <a
              href="#demo"
              className="inline-flex items-center justify-center rounded-[10px] h-12 px-6 font-medium bg-white"
              style={{ border: "1px solid #e2e8f0" }}
            >
              See it in action
            </a>
          </div>
          <p
            className="mt-4 text-[14px]"
            style={{ color: "#64748b" }}
          >
            Used by independent coaches scaling online.
          </p>
        </div>

        <div
          className="relative overflow-hidden rounded-2xl bg-white h-[420px] max-h-[420px] md:max-h-none"
          style={{
            border: "1px solid #e5e7eb",
            boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)",
          }}
        >
          <img
            src="/demo/dashboarddemo.jpeg"
            alt=""
            className="block w-full h-full object-cover object-top max-h-[420px] md:max-h-none"
          />
        </div>
      </section>

      {/* 2. "Coaching shouldn't feel like admin" Section */}
      <section className="py-24" style={{ background: "#f8fafc" }}>
        <div className="max-w-4xl mx-auto px-6">
          <p
            className="uppercase text-[14px] mb-3"
            style={{ letterSpacing: "0.08em", color: "#64748b" }}
          >
            The hidden cost of manual coaching
          </p>
          <h2
            className="text-[36px] font-semibold mb-10"
            style={{ fontSize: "36px", fontWeight: 600 }}
          >
            Coaching shouldn&apos;t feel like admin.
          </h2>
          <ul className="space-y-0">
            {[
              "Rewriting similar plans every week.",
              "Messy Google Docs and scattered templates.",
              "Copy-pasting old programming.",
              "Clients waiting on updates.",
              "No clear system as you scale.",
            ].map((text, i) => (
              <li
                key={i}
                className="flex gap-3 items-start mb-4"
                style={{ fontSize: "16px", color: "#475569" }}
              >
                <span
                  className="shrink-0 w-[3px] h-[18px] rounded-sm mt-1.5"
                  style={{ background: "#2563eb" }}
                />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-xl font-medium text-center">
            Milo Hub turns your structure into speed.
          </p>
        </div>
      </section>

      {/* 3. Before / After Section */}
      <section className="py-20">
        <div
          className="mx-auto max-w-[1000px] rounded-2xl bg-white relative grid grid-cols-1 md:grid-cols-2"
          style={{
            border: "1px solid #e5e7eb",
            boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
            padding: "48px",
            gap: "60px",
          }}
        >
          <div
            className="absolute left-1/2 top-[48px] bottom-[48px] w-px -translate-x-1/2 hidden md:block"
            style={{ background: "#e5e7eb" }}
          />
          <div className="md:pb-0 pb-10">
            <h3 className="text-2xl font-bold mb-6" style={{ color: "#64748b" }}>
              Before
            </h3>
            <ul className="space-y-3" style={{ color: "#64748b" }}>
              <li>Constant mental load</li>
              <li>Inconsistent delivery</li>
              <li>Manual plan building</li>
              <li>No scalable structure</li>
            </ul>
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-6" style={{ color: "#1e293b" }}>
              After
            </h3>
            <p className="text-[13px] mt-1.5" style={{ color: "#2563eb" }}>
              Powered by Milo Hub
            </p>
            <ul className="space-y-3 mt-4" style={{ color: "#1e293b" }}>
              <li>Confident, structured programming</li>
              <li>Clear weekly layouts</li>
              <li>AI-assisted speed with coach control</li>
              <li>A system you can scale</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. How It Works Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center">
            How it works
          </h2>
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16"
            style={{ marginTop: "64px" }}
          >
            {[
              { num: "01", title: "Add your client", desc: "Create a profile in seconds." },
              { num: "02", title: "Choose template or preset", desc: "Start from structure, not scratch." },
              { num: "03", title: "Generate & share", desc: "Deliver a clean, structured plan instantly." },
            ].map((step) => (
              <div
                key={step.num}
                className="relative rounded-2xl bg-white p-8"
                style={{
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  className="flex items-center justify-center rounded-full text-white text-[14px] font-semibold"
                  style={{ width: 32, height: 32, background: "#2563eb" }}
                >
                  {step.num}
                </div>
                <h4 className="text-xl font-semibold mt-6">{step.title}</h4>
                <p className="mt-3 text-gray-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Pricing Section */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-[14px] mb-2" style={{ color: "#64748b" }}>
            Simple pricing. No contracts.
          </p>
          <h2 className="text-3xl font-bold">
            Scale your coaching without hiring.
          </h2>
          <p
            className="mt-3 font-normal"
            style={{ fontSize: "16px", color: "#475569", lineHeight: 1.6 }}
          >
            Generate plans back-to-back.
            <br />
            Automate delivery.
            <br />
            Scale remote clients with control.
          </p>
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 rounded-3xl p-16"
            style={{
              background: "#f8fafc",
              marginTop: "48px",
              padding: "64px",
            }}
          >
            <div
              className="relative rounded-2xl bg-white p-10 text-left transition-transform duration-200"
              style={{
                border: "1px solid #e5e7eb",
              }}
            >
              <h3 className="text-xl font-semibold">Starter</h3>
              <p className="mt-2 text-gray-600">Up to 10 clients</p>
              <div style={{ height: 1, background: "#e5e7eb", margin: "16px 0" }} />
              <ul className="space-y-2" style={{ fontSize: "14px", color: "#475569", lineHeight: 1.6 }}>
                <li>Generate unlimited structured plans</li>
                <li>Back-to-back AI drafting</li>
                <li>Automation scheduling</li>
                <li>Clean client-ready delivery</li>
              </ul>
              <p className="text-[13px] mt-4" style={{ color: "#64748b" }}>
                3-day free trial
              </p>
              <a
                href="/signup"
                className="flex h-12 w-full items-center justify-center rounded-[10px] bg-blue-600 font-semibold text-white"
                style={{ marginTop: "24px" }}
              >
                Start 3-day trial
              </a>
            </div>

            <div
              className="relative rounded-2xl bg-white p-10 text-left transition-transform duration-200 scale-[1.03]"
              style={{
                border: "1px solid #e5e7eb",
                boxShadow: "0 20px 40px rgba(37,99,235,0.15)",
              }}
            >
              <div
                className="absolute left-1/2 -translate-x-1/2 -top-3 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
                style={{
                  background: "#1d4ed8",
                  boxShadow: "0 4px 14px rgba(29,78,216,0.25)",
                }}
              >
                Most Popular
              </div>
              <h3 className="text-xl font-semibold">Pro</h3>
              <p className="mt-2 text-gray-600">Up to 30 clients</p>
              <div style={{ height: 1, background: "#e5e7eb", margin: "16px 0" }} />
              <ul className="space-y-2" style={{ fontSize: "14px", color: "#475569", lineHeight: 1.6 }}>
                <li>Generate unlimited structured plans</li>
                <li>Back-to-back AI drafting</li>
                <li>Automation scheduling</li>
                <li>Clean client-ready delivery</li>
                <li>Multi-client batch efficiency</li>
              </ul>
              <p className="text-[13px] mt-4" style={{ color: "#64748b" }}>
                3-day free trial
              </p>
              <a
                href="/signup"
                className="flex h-12 w-full items-center justify-center rounded-[10px] bg-blue-600 font-semibold text-white"
                style={{ marginTop: "24px" }}
              >
                Start 3-day trial
              </a>
            </div>

            <div
              className="relative rounded-2xl bg-white p-10 text-left transition-transform duration-200"
              style={{
                border: "1px solid #e5e7eb",
              }}
            >
              <h3 className="text-xl font-semibold">Elite</h3>
              <p className="mt-2 text-gray-600">Up to 100 clients</p>
              <div style={{ height: 1, background: "#e5e7eb", margin: "16px 0" }} />
              <ul className="space-y-2" style={{ fontSize: "14px", color: "#475569", lineHeight: 1.6 }}>
                <li>Generate unlimited structured plans</li>
                <li>Back-to-back AI drafting</li>
                <li>High-volume remote scaling</li>
                <li>Priority performance</li>
              </ul>
              <p className="text-[13px] mt-4" style={{ color: "#64748b" }}>
                3-day free trial
              </p>
              <a
                href="/signup"
                className="flex h-12 w-full items-center justify-center rounded-[10px] bg-blue-600 font-semibold text-white"
                style={{ marginTop: "24px" }}
              >
                Start 3-day trial
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Final CTA Section */}
      <section
        className="py-24 text-center"
        style={{ background: "#2563eb" }}
      >
        <h2
          className="text-[40px] font-semibold text-white mb-4"
          style={{ fontSize: "40px", fontWeight: 600 }}
        >
          Run your coaching like a system.
        </h2>
        <p
          className="text-[18px] mb-8"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          Structure. Speed. Control.
        </p>
        <a
          href="/signup"
          className="inline-flex h-12 items-center justify-center rounded-[10px] bg-white px-8 font-semibold transition-[filter] hover:brightness-95"
          style={{ color: "#2563eb" }}
        >
          Start free trial
        </a>
      </section>
    </main>
  );
}
