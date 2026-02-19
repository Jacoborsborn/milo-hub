import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img
              src="/brand/milo-logo.svg"
              alt="Milo Hub logo"
              className="h-6 md:h-7 w-auto object-contain"
              style={{ marginRight: "12px" }}
            />
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/pt/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-[10px] bg-blue-600 px-6 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:bg-blue-700"
            >
              Start free trial
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}
