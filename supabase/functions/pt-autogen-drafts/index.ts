// Supabase Edge Function: pt-autogen-drafts
// Run daily via cron. For program_type='combined' only.
// Generates one week draft per plan_type (workout and/or meal) when in window.
// NEVER auto-sends. Idempotent; UNIQUE(assignment_id, week_number, plan_type) prevents duplicates.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-autogen-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDate(s: string): Date {
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date: " + s);
  return d;
}

async function insertAutogenDraftNotification(
  supabase: ReturnType<typeof createClient>,
  ptUserId: string,
  clientId: string,
  planType: "workout" | "meal",
  weekNumber: number,
  planId: string
): Promise<void> {
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle();
  const clientName = (client?.name as string)?.trim() || "Client";
  const typeLabel = planType === "meal" ? "Meal" : "Workout";
  const message = `${typeLabel} draft ready for ${clientName} — Week ${weekNumber}`;
  await supabase.from("pt_notifications").insert({
    pt_user_id: ptUserId,
    type: "autogen_draft_ready",
    title: "Draft ready",
    message,
    link_path: `/pt/app/plans/${planId}`,
    is_read: false,
  });
}

/** Call Next.js internal API to send "plan ready" email to PT (fire-and-forget). */
async function sendPlanReadyEmailToPt(
  supabase: ReturnType<typeof createClient>,
  ptUserId: string,
  clientId: string,
  planType: "workout" | "meal",
  planId: string,
  appUrl: string,
  cronSecret: string
): Promise<void> {
  try {
    const [{ data: profile }, { data: client }] = await Promise.all([
      supabase.from("profiles").select("email").eq("id", ptUserId).maybeSingle(),
      supabase.from("clients").select("name").eq("id", clientId).maybeSingle(),
    ]);
    const ptEmail = (profile?.email as string)?.trim();
    const clientName = (client?.name as string)?.trim() || "Client";
    if (!ptEmail) return;
    const res = await fetch(`${appUrl}/api/internal/send-plan-ready`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": cronSecret,
      },
      body: JSON.stringify({
        ptUserId,
        ptEmail,
        clientName,
        planType,
        planId,
      }),
    });
    if (!res.ok) {
      console.error("[pt-autogen-drafts] send-plan-ready failed", res.status, await res.text());
    }
  } catch (e) {
    console.error("[pt-autogen-drafts] sendPlanReadyEmailToPt", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const autogenSecret = Deno.env.get("AUTOGEN_SECRET");
    if (!supabaseUrl || !serviceRoleKey || !autogenSecret) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    const headerSecret = req.headers.get("x-autogen-secret");
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      const ct = req.headers.get("content-type") ?? "";
      try {
        if (ct.includes("application/json")) {
          body = await req.json();
        } else {
          const text = await req.text();
          body = text ? JSON.parse(text) : {};
        }
      } catch {
        body = {};
      }
    }
    const rawSecret =
      headerSecret?.trim() ??
      (body.secret as string | undefined) ??
      (body.autogen_secret as string | undefined) ??
      authHeader?.replace(/^\s*Bearer\s+/i, "").trim();
    const secret = typeof rawSecret === "string" ? rawSecret.trim() : "";
    if (secret !== autogenSecret) {
      const source = headerSecret !== undefined && headerSecret !== null ? "header" : body?.secret !== undefined ? "body.secret" : body?.autogen_secret !== undefined ? "body.autogen_secret" : authHeader ? "Authorization" : "none";
      console.warn("[pt-autogen-drafts] Unauthorized: source=" + source + ", receivedLen=" + secret.length + ", expectedLen=" + autogenSecret.length);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const appUrl = Deno.env.get("APP_URL") ?? "";
    if (!appUrl) {
      console.warn("[pt-autogen-drafts] APP_URL is not set; draft plan emails will not be sent. Set APP_URL in Edge Function secrets to your Next.js app URL (e.g. https://your-app.vercel.app).");
    }
    const now = new Date();
    const today = toDateOnly(now);
    const todayDow = now.getUTCDay();

    const { data: assignments, error: listErr } = await supabase
      .from("program_assignments")
      .select("id, pt_user_id, client_id, start_date, autogen_lead_days, generate_on_dow, active, auto_meals_enabled, auto_workouts_enabled, workout_template_id, meal_template_id")
      .eq("auto_generate_enabled", true)
      .eq("paused", false)
      .eq("active", true)
      .eq("program_type", "combined");

    if (listErr) {
      console.error("[pt-autogen-drafts] list assignments:", listErr);
      return new Response(
        JSON.stringify({ error: "Failed to list assignments" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: { assignment_id: string; plan_type?: string; action: string; plan_id?: string }[] = [];

    for (const a of assignments ?? []) {
      try {
        const assignDow = a.generate_on_dow ?? 6;
        console.log(`[pt-autogen-drafts] assignment ${a.id} | todayDow=${todayDow} assignDow=${assignDow} | start_date=${a.start_date} | leadDays=${a.autogen_lead_days ?? 2}`);
        
        // If today's day of week doesn't match, skip (this is a weekly recurring job)
        if (todayDow !== assignDow) {
          console.log(`[pt-autogen-drafts] SKIPPED ${a.id} — DOW mismatch (today=${todayDow}, configured=${assignDow})`);
          continue;
        }

        // Day matches - always generate! Calculate which week to generate for based on start_date
        const startDate = parseDate(a.start_date);
        const todayDate = parseDate(today);
        const leadDays = Math.min(6, Math.max(0, a.autogen_lead_days ?? 2));

        // Calculate which week we're in relative to start_date
        const diffMs = todayDate.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        const currentWeekNumber = Math.max(1, Math.floor(diffDays / 7) + 1);
        const nextWeekNumber = currentWeekNumber + 1;

        // Calculate next week start date (the Monday of next week relative to start_date)
        const nextWeekStartDays = (nextWeekNumber - 1) * 7;
        const nextWeekStartDate = new Date(startDate);
        nextWeekStartDate.setUTCDate(startDate.getUTCDate() + nextWeekStartDays);
        const nextWeekStart = toDateOnly(nextWeekStartDate);

        // Calculate current week start date
        const currentWeekStartDays = (currentWeekNumber - 1) * 7;
        const currentWeekStartDate = new Date(startDate);
        currentWeekStartDate.setUTCDate(startDate.getUTCDate() + currentWeekStartDays);
        const currentWeekStart = toDateOnly(currentWeekStartDate);

        // If today is within leadDays before next week start, generate for next week
        // Otherwise generate for current week
        const daysUntilNextWeek = Math.floor((parseDate(nextWeekStart).getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000));
        const shouldGenerateNextWeek = daysUntilNextWeek >= 0 && daysUntilNextWeek <= leadDays;

        const targetWeekNumber = shouldGenerateNextWeek ? nextWeekNumber : currentWeekNumber;
        const targetWeekStart = shouldGenerateNextWeek ? nextWeekStart : currentWeekStart;
        
        console.log(`[pt-autogen-drafts] PROCESSING ${a.id} | targetWeek=${targetWeekNumber} | targetWeekStart=${targetWeekStart} | daysUntilNextWeek=${daysUntilNextWeek} | shouldGenerateNextWeek=${shouldGenerateNextWeek}`);

        const autoWorkouts = a.auto_workouts_enabled !== false && a.workout_template_id;
        const autoMeals = a.auto_meals_enabled === true && a.meal_template_id;
        console.log(`[pt-autogen-drafts] PROCESSING ${a.id} | targetWeek=${targetWeekNumber} | targetWeekStart=${targetWeekStart} | autoMeals=${!!autoMeals} | autoWorkouts=${!!autoWorkouts}`);

        if (autoWorkouts) {
          const { data: existingWorkout } = await supabase
            .from("plans")
            .select("id, edited_at, source_hash")
            .eq("assignment_id", a.id)
            .eq("week_number", targetWeekNumber)
            .eq("plan_type", "workout")
            .maybeSingle();

          if (existingWorkout) {
            if (existingWorkout.edited_at != null) {
              results.push({ assignment_id: a.id, plan_type: "workout", action: "skipped_edited" });
            } else {
              const genRes = await fetch(`${supabaseUrl}/functions/v1/pt-plan-generator`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  autogen_secret: autogenSecret,
                  assignment_id: a.id,
                  week_number: targetWeekNumber,
                }),
              });
              const gen = genRes.ok ? (await genRes.json()) as { source_hash?: string } : null;
              const newHash = gen?.source_hash ?? "";
              if (existingWorkout.source_hash !== newHash && newHash) {
                await supabase
                  .from("plans")
                  .update({ needs_regen: true })
                  .eq("id", existingWorkout.id);
                results.push({ assignment_id: a.id, plan_type: "workout", action: "needs_regen_updated" });
              } else {
                results.push({ assignment_id: a.id, plan_type: "workout", action: "exists_unchanged" });
              }
            }
          } else {
            const genRes = await fetch(`${supabaseUrl}/functions/v1/pt-plan-generator`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                autogen_secret: autogenSecret,
                assignment_id: a.id,
                week_number: targetWeekNumber,
              }),
            });

            if (!genRes.ok) {
              const errText = await genRes.text();
              console.error("[pt-autogen-drafts] workout invoke error for", a.id, errText);
              results.push({ assignment_id: a.id, plan_type: "workout", action: "error", error: errText });
            } else {
              const data = (await genRes.json()) as { week?: unknown; source_hash?: string };
              if (!data?.week) {
                results.push({ assignment_id: a.id, plan_type: "workout", action: "error", error: "No week in response" });
              } else {
                const { data: inserted, error: insertErr } = await supabase
                  .from("plans")
                  .insert({
                    pt_user_id: a.pt_user_id,
                    client_id: a.client_id,
                    plan_type: "workout",
                    content_json: { week: data.week, week_number: targetWeekNumber },
                    assignment_id: a.id,
                    week_number: targetWeekNumber,
                    status: "draft",
                    generated_by: "auto",
                    source_hash: data.source_hash ?? null,
                    review_status: "ready",
                    review_ready_at: new Date().toISOString(),
                  })
                  .select("id")
                  .single();

                if (insertErr) {
                  if (insertErr.code === "23505") {
                    results.push({ assignment_id: a.id, plan_type: "workout", action: "duplicate_skipped" });
                  } else {
                    console.error("[pt-autogen-drafts] workout insert error", insertErr);
                    results.push({ assignment_id: a.id, plan_type: "workout", action: "insert_error", error: insertErr.message });
                  }
                } else {
                  results.push({ assignment_id: a.id, plan_type: "workout", action: "created", plan_id: inserted?.id });
                  await insertAutogenDraftNotification(
                    supabase,
                    a.pt_user_id,
                    a.client_id,
                    "workout",
                    targetWeekNumber,
                    inserted!.id
                  );
                  if (appUrl) {
                    await sendPlanReadyEmailToPt(
                      supabase,
                      a.pt_user_id,
                      a.client_id,
                      "workout",
                      inserted!.id,
                      appUrl,
                      autogenSecret
                    );
                  }
                }
              }
            }
          }
        }

        if (autoMeals) {
          const { data: existingMeal } = await supabase
            .from("plans")
            .select("id, edited_at")
            .eq("assignment_id", a.id)
            .eq("week_number", targetWeekNumber)
            .eq("plan_type", "meal")
            .maybeSingle();

          if (existingMeal) {
            if (existingMeal.edited_at != null) {
              results.push({ assignment_id: a.id, plan_type: "meal", action: "skipped_edited" });
            } else {
              results.push({ assignment_id: a.id, plan_type: "meal", action: "exists_unchanged" });
            }
          } else {
            // Meal autogen: fetch template + client, invoke pt-meal-generator, insert plan
            const { data: mealTemplate } = await supabase
              .from("pt_meal_templates")
              .select("id, defaults")
              .eq("id", a.meal_template_id)
              .maybeSingle();

            if (!mealTemplate?.defaults) {
              results.push({ assignment_id: a.id, plan_type: "meal", action: "skipped", message: "meal_template_not_found" });
            } else {
              const { data: client } = await supabase
                .from("clients")
                .select("id, presets_json")
                .eq("id", a.client_id)
                .maybeSingle();

              const templateDefaults = (mealTemplate.defaults as Record<string, unknown>) ?? {};
              const clientMeal = client?.presets_json && typeof client.presets_json === "object" && (client.presets_json as Record<string, unknown>).meal
                ? (client.presets_json as Record<string, unknown>).meal as Record<string, unknown>
                : {};
              const mealInputs = {
                dietaryPreference: templateDefaults.dietaryPreference ?? clientMeal.dietaryPreference ?? "balanced",
                mealsPerDay: Number(templateDefaults.mealsPerDay ?? clientMeal.mealsPerDay ?? 4) || 4,
                days: Number(templateDefaults.days ?? clientMeal.days ?? 7) || 7,
                dietGoal: templateDefaults.dietGoal ?? clientMeal.dietGoal ?? "maintain",
                caloriesTargetPerDay: Number(templateDefaults.caloriesTargetPerDay ?? clientMeal.caloriesTargetPerDay ?? 2000) || 2000,
                budgetTier: String(templateDefaults.budgetTier ?? clientMeal.budgetTier ?? "medium").toLowerCase() || "medium",
                allergies: Array.isArray(templateDefaults.allergies) ? templateDefaults.allergies : Array.isArray(clientMeal.allergies) ? clientMeal.allergies : [],
                restrictions: Array.isArray(templateDefaults.restrictions) ? templateDefaults.restrictions : Array.isArray(clientMeal.restrictions) ? clientMeal.restrictions : [],
              };

              const genRes = await fetch(`${supabaseUrl}/functions/v1/pt-meal-generator`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  autogen_secret: autogenSecret,
                  mealInputs,
                }),
              });

              if (!genRes.ok) {
                const errText = await genRes.text();
                console.error("[pt-autogen-drafts] meal invoke error for", a.id, errText);
                results.push({ assignment_id: a.id, plan_type: "meal", action: "error", error: errText });
              } else {
                const data = (await genRes.json()) as { mealPlan?: Record<string, unknown>; grocerySections?: unknown[]; groceryTotals?: unknown };
                const mealPlan = data?.mealPlan;
                const grocerySections = data?.grocerySections ?? [];
                const groceryTotals = data?.groceryTotals ?? {};
                if (!mealPlan?.days) {
                  results.push({ assignment_id: a.id, plan_type: "meal", action: "error", error: "No mealPlan.days in response" });
                } else {
                  const contentJson = {
                    ...mealPlan,
                    grocerySections,
                    groceryTotals,
                    meta: { coachMessage: "", week_number: targetWeekNumber },
                    week_number: targetWeekNumber,
                  };
                  const { data: inserted, error: insertErr } = await supabase
                    .from("plans")
                    .insert({
                      pt_user_id: a.pt_user_id,
                      client_id: a.client_id,
                      plan_type: "meal",
                      content_json: contentJson,
                      assignment_id: a.id,
                      week_number: targetWeekNumber,
                      status: "draft",
                      generated_by: "auto",
                      review_status: "ready",
                      review_ready_at: new Date().toISOString(),
                    })
                    .select("id")
                    .single();

                  if (insertErr) {
                    if (insertErr.code === "23505") {
                      results.push({ assignment_id: a.id, plan_type: "meal", action: "duplicate_skipped" });
                    } else {
                      console.error("[pt-autogen-drafts] meal insert error", insertErr);
                      results.push({ assignment_id: a.id, plan_type: "meal", action: "insert_error", error: insertErr.message });
                    }
                  } else {
                    results.push({ assignment_id: a.id, plan_type: "meal", action: "created", plan_id: inserted?.id });
                    await insertAutogenDraftNotification(
                      supabase,
                      a.pt_user_id,
                      a.client_id,
                      "meal",
                      targetWeekNumber,
                      inserted!.id
                    );
                    if (appUrl) {
                      await sendPlanReadyEmailToPt(
                        supabase,
                        a.pt_user_id,
                        a.client_id,
                        "meal",
                        inserted!.id,
                        appUrl,
                        autogenSecret
                      );
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("[pt-autogen-drafts] assignment", a.id, e);
        results.push({
          assignment_id: a.id,
          action: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, today, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[pt-autogen-drafts]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
