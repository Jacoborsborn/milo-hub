"use client";

import Link from "next/link";
import SectionHeader from "./SectionHeader";
import { typography } from "@/styles/design-tokens";

const ACTIONS = [
  { href: "/pt/app/clients/new", label: "Add client" },
  { href: "/templates", label: "Programs" },
  { href: "/pt/app/clients", label: "View all clients" },
];

export default function QuickActions() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <SectionHeader title="Quick actions" subtitle="Shortcuts to common tasks." />
      </div>
      <div className="px-5 pb-5">
        <ul className="space-y-1">
          {ACTIONS.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={`block rounded-lg px-3 py-2.5 font-medium text-neutral-800 hover:bg-neutral-50 transition-colors ${typography.body}`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
