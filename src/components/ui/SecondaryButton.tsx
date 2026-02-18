"use client";

import Link from "next/link";
import { radii } from "@/styles/design-tokens";

type SecondaryButtonProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export default function SecondaryButton({ href, children, className = "" }: SecondaryButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center min-h-[40px] px-4 font-medium rounded-lg border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 transition-colors text-sm ${radii.button} ${className}`}
    >
      {children}
    </Link>
  );
}
