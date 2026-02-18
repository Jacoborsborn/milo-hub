/**
 * Lightweight design tokens for Milo PT Hub.
 * Use for consistent typography, spacing, radii, shadows, and semantic colors.
 * Tailwind classes below reference these concepts; extend globals.css for CSS vars if needed.
 */

export const typography = {
  /** Page title */
  title: "text-2xl font-semibold tracking-tight text-neutral-900",
  /** Section heading */
  section: "text-sm font-semibold uppercase tracking-wider text-neutral-500",
  /** Card/list heading */
  cardTitle: "text-base font-semibold text-neutral-900",
  /** Body */
  body: "text-sm text-neutral-700",
  /** Muted / secondary */
  muted: "text-xs text-neutral-500",
  /** Numeric / data */
  numeric: "text-lg font-semibold tabular-nums text-neutral-900",
} as const;

export const spacing = {
  /** Section gap */
  section: "space-y-6",
  /** Card internal padding */
  card: "p-5",
  /** Tight row */
  row: "gap-3",
  /** Stack items */
  stack: "space-y-2",
  /** Page horizontal padding */
  pageX: "px-4 sm:px-6",
  pageY: "py-6 sm:py-8",
} as const;

export const radii = {
  card: "rounded-xl",
  button: "rounded-lg",
  badge: "rounded-md",
  input: "rounded-lg",
} as const;

export const shadows = {
  card: "shadow-sm",
  cardHover: "shadow",
  dropdown: "shadow-lg",
} as const;

export const borders = {
  default: "border border-neutral-200",
  subtle: "border border-neutral-100",
  strong: "border border-neutral-300",
} as const;

/** Semantic status for plan due / badges */
export const statusColors = {
  on_track: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  due_soon: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  overdue: {
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-200",
  },
  no_plan: {
    bg: "bg-neutral-100",
    text: "text-neutral-600",
    border: "border-neutral-200",
  },
} as const;

export type StatusKey = keyof typeof statusColors;
