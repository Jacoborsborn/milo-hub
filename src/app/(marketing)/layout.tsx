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
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-gray-900">
            <img src="/brand/milo-logo.svg" alt="" className="h-8 w-auto object-contain" />
            Milo Hub
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/pt/auth/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-white bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700"
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
