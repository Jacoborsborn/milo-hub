"use client";

import EmptyState from "./EmptyState";

type ActivityFeedProps = {
  /** Optional list of recent activity items; when empty, show empty state. Max 5 shown. */
  items?: { id: string; label: string; href?: string; time?: string }[];
};

const CheckIcon = () => (
  <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

export default function ActivityFeed({ items = [] }: ActivityFeedProps) {
  const displayItems = items.slice(0, 5);

  return (
    <div className="rounded-xl shadow-sm bg-white p-6">
      <h2 className="text-base font-semibold text-neutral-900">Recent activity</h2>
      <p className="text-sm text-neutral-500 mt-0.5">Latest plan deliveries.</p>
      <div className="mt-4">
        {displayItems.length === 0 ? (
          <EmptyState
            title="No recent activity"
            description="When you create or update plans, they’ll show here."
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {displayItems.map((item) => (
              <li key={item.id} className="flex gap-3">
                <CheckIcon />
                <div className="min-w-0">
                  {item.href ? (
                    <a href={item.href} className="font-medium text-neutral-900 hover:underline block truncate">
                      {item.label}
                    </a>
                  ) : (
                    <span className="font-medium text-neutral-900 block truncate">{item.label}</span>
                  )}
                  {item.time && (
                    <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
