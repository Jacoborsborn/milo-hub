export default function MarketingHomePage() {
    return (
      <main className="bg-white text-black">
        {/* HERO */}
        <section className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              Build client plans in minutes.
              <br />
              Deliver them like a pro.
            </h1>
  
            <p className="mt-6 text-lg text-gray-600">
              Milo Hub helps independent coaches generate structured workout
              plans fast — without losing control of their programming.
            </p>
  
            <div className="mt-8 flex gap-4">
              <a
                href="/signup"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium"
              >
                Start free trial
              </a>
  
              <a
                href="#demo"
                className="px-6 py-3 border border-gray-300 rounded-lg font-medium"
              >
                See it in action
              </a>
            </div>
  
            <div className="mt-6 text-sm text-gray-500 space-y-1">
              <p>Less admin. More coaching.</p>
              <p>Structured delivery clients understand.</p>
              <p>Templates turn into your system.</p>
            </div>
          </div>
  
          <div className="bg-gray-100 rounded-2xl h-[400px] flex items-center justify-center">
            <span className="text-gray-400">
              Dashboard preview placeholder
            </span>
          </div>
        </section>
  
        {/* PROBLEM */}
        <section className="bg-gray-50 py-20">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center">
              Coaching shouldn’t feel like admin.
            </h2>
  
            <div className="mt-10 space-y-4 text-gray-600 text-lg">
              <p>Rewriting similar plans every week.</p>
              <p>Messy Google Docs and scattered templates.</p>
              <p>Copy-pasting old programming.</p>
              <p>Clients waiting on updates.</p>
              <p>No clear system as you scale.</p>
            </div>
  
            <p className="mt-8 text-xl font-medium text-center">
              Milo Hub turns your structure into speed.
            </p>
          </div>
        </section>
  
        {/* BEFORE / AFTER */}
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold mb-6">Before</h3>
              <ul className="space-y-3 text-gray-600">
                <li>Constant mental load</li>
                <li>Inconsistent delivery</li>
                <li>Manual plan building</li>
                <li>No scalable structure</li>
              </ul>
            </div>
  
            <div>
              <h3 className="text-2xl font-bold mb-6">After</h3>
              <ul className="space-y-3 text-gray-600">
                <li>Confident, structured programming</li>
                <li>Clear weekly layouts</li>
                <li>AI-assisted speed with coach control</li>
                <li>A system you can scale</li>
              </ul>
            </div>
          </div>
        </section>
  
        {/* HOW IT WORKS */}
        <section className="bg-gray-50 py-20">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center">
              How it works
            </h2>
  
            <div className="mt-12 grid md:grid-cols-3 gap-10 text-center">
              <div>
                <h4 className="text-xl font-semibold">1. Add your client</h4>
                <p className="mt-4 text-gray-600">
                  Create a profile in seconds.
                </p>
              </div>
  
              <div>
                <h4 className="text-xl font-semibold">
                  2. Choose template or preset
                </h4>
                <p className="mt-4 text-gray-600">
                  Start from structure, not scratch.
                </p>
              </div>
  
              <div>
                <h4 className="text-xl font-semibold">
                  3. Generate & share
                </h4>
                <p className="mt-4 text-gray-600">
                  Deliver a clean, structured plan instantly.
                </p>
              </div>
            </div>
          </div>
        </section>
  
        {/* PRICING */}
        <section className="py-24">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold">
              Pay for the scale you need.
            </h2>
  
            <div className="mt-16 grid md:grid-cols-3 gap-8">
              <div className="border rounded-2xl p-8">
                <h3 className="text-xl font-semibold">Starter</h3>
                <p className="mt-2 text-gray-600">Up to 10 clients</p>
                <a href="/signup" className="block mt-6 bg-blue-600 text-white py-2 rounded-lg">
                  Start
                </a>
              </div>
  
              <div className="border rounded-2xl p-8">
                <h3 className="text-xl font-semibold">Pro</h3>
                <p className="mt-2 text-gray-600">Up to 30 clients</p>
                <a href="/signup" className="block mt-6 bg-blue-600 text-white py-2 rounded-lg">
                  Start
                </a>
              </div>
  
              <div className="border rounded-2xl p-8">
                <h3 className="text-xl font-semibold">Elite</h3>
                <p className="mt-2 text-gray-600">Up to 100 clients</p>
                <a href="/signup" className="block mt-6 bg-blue-600 text-white py-2 rounded-lg">
                  Start
                </a>
              </div>
            </div>
          </div>
        </section>
  
        {/* FINAL CTA */}
        <section className="bg-blue-600 text-white py-20 text-center">
          <h2 className="text-3xl font-bold">
            Ready to run coaching like a system?
          </h2>
  
          <a
            href="/signup"
            className="inline-block mt-8 bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold"
          >
            Start free trial
          </a>
        </section>
      </main>
    );
  }
  