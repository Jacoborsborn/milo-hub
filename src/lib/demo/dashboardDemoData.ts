// src/lib/demo/dashboardDemoData.ts
export type DemoClientCard = {
    id: string;
    name: string;
    status: "plan_needed" | "on_track" | "due_soon" | "overdue";
    subtitle: string;
    lastUpdatedLabel: string;
    primaryCtaLabel: string;
  };
  
  export type DemoDashboardStats = {
    activeClients: number;
    plansThisWeek: number;
    timeSavedLabel: string;
    plansThisMonth: number;
  };
  
  export const demoDashboardStats: DemoDashboardStats = {
    activeClients: 28,
    plansThisWeek: 7,
    timeSavedLabel: "12h 40m",
    plansThisMonth: 22,
  };
  
  export const demoClientCards: DemoClientCard[] = [
    {
      id: "c_001",
      name: "Aisha Khan",
      status: "overdue",
      subtitle: "Cutting • 4 days/week • Gym",
      lastUpdatedLabel: "Last plan: 7 days ago",
      primaryCtaLabel: "Fix overdue plan",
    },
    {
      id: "c_002",
      name: "Tom Gallagher",
      status: "due_soon",
      subtitle: "Hypertrophy • 5 days/week • Full gym",
      lastUpdatedLabel: "Due in 24h",
      primaryCtaLabel: "Generate plan",
    },
    {
      id: "c_003",
      name: "Leah Morgan",
      status: "plan_needed",
      subtitle: "Beginner • 3 days/week • Home",
      lastUpdatedLabel: "No plan created yet",
      primaryCtaLabel: "Create first plan",
    },
    {
      id: "c_004",
      name: "Ben Clarke",
      status: "on_track",
      subtitle: "Strength • 4 days/week • Gym",
      lastUpdatedLabel: "Next check-in: Fri",
      primaryCtaLabel: "View plan",
    },
    {
      id: "c_005",
      name: "Sofia Patel",
      status: "plan_needed",
      subtitle: "Recomp • 4 days/week • Gym",
      lastUpdatedLabel: "No plan created yet",
      primaryCtaLabel: "Create plan",
    },
    {
      id: "c_006",
      name: "Jack Wilson",
      status: "on_track",
      subtitle: "Athlete • 6 days/week • Gym",
      lastUpdatedLabel: "Plan updated: yesterday",
      primaryCtaLabel: "View plan",
    },
  ];
  