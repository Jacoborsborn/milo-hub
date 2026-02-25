"use server";

import { listClients } from "./clients";
import { listPlansForPtUser, listAutoDraftPlansForDashboard } from "./plans";
import { supabaseServer } from "../supabase/server";
import type { Client } from "@/types/database";
import type { Plan } from "@/types/database";

export type PlanStatus = "on_track" | "due_soon" | "overdue" | "no_plan";

export type DashboardClient = {
  id: string;
  name: string;
  status: PlanStatus;
  dueInDays: number | null;
  overdueByDays: number | null;
  latestPlanDate: string | null;
  latestPlanId: string | null;
  completedDays: number | null;
  totalDays: number | null;
};

export type RecentActivityItem = {
  planId: string;
  clientId: string;
  clientName: string;
  createdAt: string;
};

export type AutoDraftItem = {
  id: string;
  client_id: string;
  clientName: string;
  planName: string;
};

export type PtDashboardSummary = {
  activeClients: number;
  plansThisWeek: number;
  plansThisMonth: number;
  timeSavedMinutes: number;
  timeSavedLabel: string;
  clients: DashboardClient[];
  overdueCount: number;
  dueSoonCount: number;
  noPlanCount: number;
  /** Auto-generated drafts ready for review */
  autoDrafts: AutoDraftItem[];
  /** Most recent 5 plans from last 14 days (newest first) for Recent activity */
  recentActivity: RecentActivityItem[];
};

const MINUTES_ESTIMATE_PER_PLAN = 25;

/** Format minutes as "Xh Ym" for dashboard display */
function formatTimeSavedLabel(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Status from days since last plan (created_at):
 * - no_plan: client has no plan
 * - overdue: last plan > 28 days ago
 * - due_soon: last plan 14–28 days ago
 * - on_track: last plan within 14 days
 */
function parseStatusFromLastPlan(latestPlanDate: string | null): {
  status: PlanStatus;
  dueInDays: number | null;
  overdueByDays: number | null;
} {
  if (!latestPlanDate) {
    return { status: "no_plan", dueInDays: null, overdueByDays: null };
  }
  const last = new Date(latestPlanDate).getTime();
  const now = Date.now();
  const daysSince = Math.floor((now - last) / (24 * 60 * 60 * 1000));

  if (daysSince > 28) {
    return { status: "overdue", dueInDays: null, overdueByDays: daysSince - 28 };
  }
  if (daysSince > 14) {
    return { status: "due_soon", dueInDays: 28 - daysSince, overdueByDays: null };
  }
  return { status: "on_track", dueInDays: null, overdueByDays: null };
}

function isInWeek(isoDate: string, ref: Date): boolean {
  const d = new Date(isoDate.slice(0, 10));
  const start = new Date(ref);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return d >= start && d <= end;
}

function isInMonth(isoDate: string, ref: Date): boolean {
  const d = new Date(isoDate.slice(0, 10));
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

/**
 * Build dashboard summary from existing clients and plans (no analytics tables).
 */
export async function getPtDashboardSummary(): Promise<PtDashboardSummary> {
  const [clients, plans] = await Promise.all([listClients(), listPlansForPtUser()]);

  // Fetch completion counts for latest plans
  const latestPlanIds = plans
    .filter((p, i, arr) => arr.findIndex((x) => x.client_id === p.client_id) === i)
    .map((p) => p.id);

  const supabase = await supabaseServer();
  const { data: completionRows } =
    latestPlanIds.length > 0
      ? await supabase.from("plan_completions").select("plan_id").in("plan_id", latestPlanIds)
      : { data: [] };

  const completionCountByPlanId = new Map<string, number>();
  for (const row of completionRows ?? []) {
    const r = row as { plan_id: string };
    completionCountByPlanId.set(r.plan_id, (completionCountByPlanId.get(r.plan_id) ?? 0) + 1);
  }

  // Count total days per plan from content_json.weeks
  function countTotalDays(plan: Plan): number {
    const weeks = (plan.content_json as any)?.weeks as { days?: unknown[] }[] | undefined;
    if (!weeks) return 0;
    return weeks.reduce((sum, w) => sum + (w.days?.length ?? 0), 0);
  }

  const now = new Date();
  const plansThisWeek = plans.filter((p) => isInWeek(p.created_at, now)).length;
  const plansThisMonth = plans.filter((p) => isInMonth(p.created_at, now)).length;

  const latestPlanByClient = new Map<string, Plan>();
  for (const p of plans) {
    if (!latestPlanByClient.has(p.client_id)) {
      latestPlanByClient.set(p.client_id, p);
    }
  }

  const clientsList: DashboardClient[] = clients.map((c: Client) => {
    const latest = latestPlanByClient.get(c.id);
    const latestPlanDate = latest ? latest.created_at : null;
    const { status, dueInDays, overdueByDays } = parseStatusFromLastPlan(latestPlanDate);
    return {
      id: c.id,
      name: c.name,
      status,
      dueInDays,
      overdueByDays,
      latestPlanDate: latest ? latest.created_at : null,
      latestPlanId: latest?.id ?? null,
      completedDays: completionCountByPlanId.get(latest?.id ?? "") ?? null,
      totalDays: latest ? countTotalDays(latest) : null,
    };
  });

  const overdueCount = clientsList.filter((c) => c.status === "overdue").length;
  const dueSoonCount = clientsList.filter((c) => c.status === "due_soon").length;
  const noPlanCount = clientsList.filter((c) => c.status === "no_plan").length;
  const timeSavedLabel = formatTimeSavedLabel(plansThisWeek * MINUTES_ESTIMATE_PER_PLAN);

  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const recentActivity: RecentActivityItem[] = plans
    .filter((p) => new Date(p.created_at) >= fourteenDaysAgo)
    .slice(0, 5)
    .map((p) => ({
      planId: p.id,
      clientId: p.client_id,
      clientName: clientById.get(p.client_id)?.name ?? "Unknown",
      createdAt: p.created_at,
    }));

  let autoDrafts: AutoDraftItem[] = [];
  try {
    autoDrafts = await listAutoDraftPlansForDashboard();
  } catch {
    // ignore
  }

  return {
    activeClients: clients.length,
    plansThisWeek,
    plansThisMonth,
    timeSavedMinutes: plansThisWeek * MINUTES_ESTIMATE_PER_PLAN,
    timeSavedLabel,
    clients: clientsList,
    overdueCount,
    dueSoonCount,
    noPlanCount,
    autoDrafts,
    recentActivity,
  };
}
