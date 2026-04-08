// src/app/(marketing)/demo/page.tsx

export const metadata = {
    title: "Milo Hub — Demo",
    description: "See how Milo Hub turns your coaching structure into speed.",
    robots: {
      index: false,
      follow: false,
    },
  };
  
  export default function DemoPage() {
    return (
      <main className="bg-white text-black">
        {/* Top nav */}
        <header className="border-b bg-white/80 backdrop-blur">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <img src="/brand/milo-logo.svg" alt="" className="h-7 w-auto object-contain" />
              Milo Hub
            </div>
            <div className="flex items-center gap-3">
              <a href="/login" className="text-sm text-gray-700 hover:text-black">
                Login
              </a>
              <a
                href="/signup"
                className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-medium"
              >
                Start free trial
              </a>
            </div>
          </div>
        </header>
  
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-10">
          <p className="text-sm text-gray-500">Product demo</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-bold leading-tight">
            A clean coaching system.
            <br />
            Built for speed and control.
          </h1>
          <p className="mt-5 text-lg text-gray-600 max-w-2xl">
            This page shows how the workspace looks when you’re managing clients
            and generating plans. No fluff — just the workflow and the output.
          </p>
  
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/signup"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium"
            >
              Start free trial
            </a>
            <a
              href="/#pricing"
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium"
            >
              View pricing
            </a>
          </div>
        </section>
  
        {/* 3 steps */}
        <section className="max-w-6xl mx-auto px-6 pb-10">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="border rounded-2xl p-6">
              <p className="text-sm text-gray-500">Step 1</p>
              <h3 className="mt-2 text-lg font-semibold">Add a client</h3>
              <p className="mt-2 text-gray-600">
                Create a profile in seconds so your coaching has a home.
              </p>
            </div>
  
            <div className="border rounded-2xl p-6">
              <p className="text-sm text-gray-500">Step 2</p>
              <h3 className="mt-2 text-lg font-semibold">Generate from structure</h3>
              <p className="mt-2 text-gray-600">
                Start from your templates and presets — not a blank page.
              </p>
            </div>
  
            <div className="border rounded-2xl p-6">
              <p className="text-sm text-gray-500">Step 3</p>
              <h3 className="mt-2 text-lg font-semibold">Deliver like a pro</h3>
              <p className="mt-2 text-gray-600">
                Share clean plan views that clients can actually follow.
              </p>
            </div>
          </div>
        </section>
  
        {/* Screenshot block 1 */}
        <section className="max-w-6xl mx-auto px-6 pb-16">
          <h2 className="text-2xl font-bold">Command Centre</h2>
          <p className="mt-2 text-gray-600 max-w-2xl">
            Your day at a glance: who’s overdue, what’s due soon, and what needs a
            plan — with clear next actions.
          </p>
  
          <div className="mt-8 border rounded-2xl overflow-hidden bg-gray-50">
            <div className="aspect-[16/9]">
              <img
                src="/demo/dashboarddemo.jpeg"
                alt="Milo PT Hub dashboard demo"
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
  
          <p className="mt-3 text-sm text-gray-500">
            Tip: keep demo data realistic. Clean UI builds trust.
          </p>
        </section>
  
        {/* Screenshot block 2 */}
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <h2 className="text-2xl font-bold">Plan delivery</h2>
          <p className="mt-2 text-gray-600 max-w-2xl">
            The output matters. Plans should feel structured, professional, and
            easy to follow — not like a messy note dump.
          </p>
  
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <div className="border rounded-2xl overflow-hidden bg-gray-50">
              <div className="aspect-[4/3] flex items-center justify-center">
                <span className="text-gray-400 text-sm">
                  Add screenshot: /public/demo/plan-view.png
                </span>
              </div>
            </div>
  
            <div className="border rounded-2xl overflow-hidden bg-gray-50">
              <div className="aspect-[4/3] flex items-center justify-center">
                <span className="text-gray-400 text-sm">
                  Add screenshot: /public/demo/share-view-mobile.png
                </span>
              </div>
            </div>
          </div>
        </section>
  
        {/* CTA */}
        <section className="bg-blue-600 text-white">
          <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h2 className="text-3xl font-bold">Ready to run coaching like a system?</h2>
              <p className="mt-2 text-blue-100">
                Start simple. Add one client. Generate one plan. Build momentum.
              </p>
            </div>
            <a
              href="/signup"
              className="bg-white text-blue-600 px-7 py-3 rounded-lg font-semibold"
            >
              Start free trial
            </a>
          </div>
        </section>
  
        {/* Footer */}
        <footer className="border-t">
          <div className="max-w-6xl mx-auto px-6 py-10 text-sm text-gray-600 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} Milo Hub</p>
            <div className="flex gap-4">
              <a href="/privacy" className="hover:text-black">Privacy</a>
              <a href="/terms" className="hover:text-black">Terms</a>
              <a href="/contact" className="hover:text-black">Contact</a>
            </div>
          </div>
        </footer>
      </main>
    );
  }
  