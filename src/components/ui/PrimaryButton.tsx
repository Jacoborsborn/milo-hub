"use client";

import Link from "next/link";
import { radii } from "@/styles/design-tokens";

type PrimaryButtonProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export default function PrimaryButton({ href, children, className = "" }: PrimaryButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center min-h-[40px] px-4 font-medium rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors text-sm ${radii.button} ${className}`}
    >
      {children}
    </Link>
  );
}
