"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/browser";
import { listClients } from "@/lib/services/clients";
import { createJobAndRunWorkoutGeneration } from "./actions";
import Breadcrumbs from "@/components/pt/Breadcrumbs";
import type { Client } from "@/types/database";

type TemplateRow = {
  id: string;
  name: string;
  goal: string;
  experience_level: string;
  days_per_week: number;
  equipment_type: string;
  duration_weeks: number;
};

export default function AssignTemplatePage() {
  const params = useParams<{ templateId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateId = params?.templateId as string;
  const clientIdFromQuery = searchParams.get("client_id") ?? "";

  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(clientIdFromQuery);
  const [coachMessage, setCoachMessage] = useState("");

  useEffect(() => {
    if (clientIdFromQuery && !selectedClientId) setSelectedClientId(clientIdFromQuery);
  }, [clientIdFromQuery, selectedClientId]);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/pt/auth/login");
        return;
      }
      const [templateRes, clientsList] = await Promise.all([
        supabase
          .from("pt_templates")
          .select("id,name,goal,experience_level,days_per_week,equipment_type,duration_weeks")
          .eq("id", templateId)
          .single(),
        listClients(),
      ]);
      if (cancelled) return;
      if (templateRes.error || !templateRes.data) {
        setError(templateRes.error?.message ?? "Program not found");
        setTemplate(null);
      } else {
        setTemplate(templateRes.data as TemplateRow);
      }
      setClients(clientsList ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, router]);

  const handleGenerateDraft = async () => {
    if (!template || !selectedClientId) {
      setError("Please select a client");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const { planId } = await createJobAndRunWorkoutGeneration(
        selectedClientId,
        templateId,
        {
          goal: template.goal,
          experience_level: template.experience_level,
          days_per_week: template.days_per_week,
          equipment_type: template.equipment_type,
        },
        coachMessage.trim() || undefined
      );
      router.push(`/pt/app/plans/${planId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate draft";
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-neutral-500">Loading…</p>
      </div>
    );
  }
  if (!template) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-red-600 mb-4">{error ?? "Program not found"}</p>
        <Link href="/templates" className="text-neutral-600 hover:text-neutral-900 underline">
          ← Back to Programs
        </Link>
      </div>
    );
  }

  const formatChip = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <Breadcrumbs
        items={[
          { label: "Programs", href: "/templates" },
          { label: template.name, href: `/templates/${templateId}/edit` },
          { label: "Assign" },
        ]}
      />

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-5 border-b border-neutral-100 bg-neutral-50/50">
          <h1 className="text-xl font-semibold text-neutral-900 m-0">Assign program</h1>
          <p className="text-sm text-neutral-600 mt-1">
            {template.name} · {template.duration_weeks} weeks · {template.days_per_week} days/week · {formatChip(template.goal)} · {formatChip(template.equipment_type)}
          </p>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="client-select" className="block text-sm font-semibold text-neutral-800 mb-2">
              Client
            </label>
            <select
              id="client-select"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
            >
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="coach-message" className="block text-sm font-semibold text-neutral-800 mb-2">
              Coach message (optional)
            </label>
            <textarea
              id="coach-message"
              value={coachMessage}
              onChange={(e) => setCoachMessage(e.target.value)}
              placeholder="Write a short message for the client…"
              rows={3}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
            />
            <p className="mt-1.5 text-xs text-neutral-500">Shown to the client with their plan.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleGenerateDraft}
              disabled={generating || !selectedClientId}
              className="min-h-[40px] rounded-lg bg-neutral-800 text-white px-5 py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? "Generating…" : "Generate draft"}
            </button>
            <Link
              href={`/templates/${templateId}/edit`}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Edit program
            </Link>
            <Link
              href="/templates"
              className="text-sm text-neutral-600 hover:text-neutral-900 underline"
            >
              Programs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
