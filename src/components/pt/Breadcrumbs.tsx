import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-xs text-neutral-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-x-1.5">
          {i > 0 && <span className="text-neutral-400 select-none">›</span>}
          {item.href ? (
            <Link
              href={item.href}
              className="text-neutral-600 hover:text-neutral-900 hover:underline focus:outline-none focus:underline"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-neutral-800 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
