# Workout plan generation audit – "0 day(s)" diagnosis

## 1. Files changed

| File | Change |
|------|--------|
| `src/lib/debug/correlation.ts` | **New** – `newCorrelationId()`, `DEBUG_GENERATION` flag |
| `src/lib/services/generator.ts` | Pass `correlationId` to edge; return `rawResponse`; debug log |
| `src/app/templates/[templateId]/assign/actions.ts` | Accept `correlationId`; debug log; return `requestPayload`, `rawResponse` |
| `src/app/templates/[templateId]/assign/page.tsx` | Generate `correlationId` (when DEBUG); log before/after; set `pt_plan_draft_debug` in sessionStorage |
| `src/app/plans/review/page.tsx` | Read `pt_plan_draft_debug`; Debug collapsible panel when `NEXT_PUBLIC_DEBUG_GENERATION=true` |
| `src/app/plans/review/actions.ts` | Debug log content_json before save; call `logSavedPlanContentIfDebug` after save |
| `src/components/PlanRenderer.tsx` | Debug log: path used (`source.weeks`), `weeksLength`, per-week `daysLength` |
| `supabase/functions/pt-workout-generator/index.ts` | Log `correlationId`, payload, prompt summary, raw output, parsed, normalised |
| `src/lib/services/plansDebug.ts` | **New** – `logSavedPlanContentIfDebug(planId)` reads saved plan and logs content_json summary |

## 2. Env flag

- **Name:** `NEXT_PUBLIC_DEBUG_GENERATION`
- **Where:** `.env.local` (or env in your host)
- **Value:** `true` to enable all audit logs and the Debug panel; omit or `false` to disable.

Example `.env.local`:

```bash
NEXT_PUBLIC_DEBUG_GENERATION=true
```

Restart the Next dev server after changing.

## 3. How to reproduce

1. Set `NEXT_PUBLIC_DEBUG_GENERATION=true` and restart dev server.
2. Go to **Programs** → open a workout program → **Assign**.
3. Select a client, click **Generate draft**.
4. When redirected to **Plan Review (Draft)**:
   - Open the **Debug (generation audit)** panel.
   - Note **correlationId** (use it to grep Supabase function logs).
5. In the browser console (F12):
   - `[AssignTemplate] generation start` – correlationId, clientId, templateId.
   - `[AssignTemplate] generation response` – planKeys, weeksLength.
   - `[PlanRenderer] audit` – pathUsed, weeksLength, weekDetails (per-week keys and days length).
6. In Supabase Dashboard → Edge Functions → pt-workout-generator → Logs, search for the same `correlationId`.
7. (Optional) Click **Confirm & Save**; in server logs check `[saveDraftPlanAction] content_json to save` and `[plansDebug] planId=...`.

## 4. Diagnosis template

Fill after collecting logs:

- **Generator called?** yes / no
- **Payload correct?** yes / no (if no: what's wrong)
- **Edge returned valid weeks/days?** yes / no (if no: what's missing)
- **Save correct?** yes / no
- **UI expects which keys?** e.g. `source.weeks[].days`
- **What exists instead?** e.g. `source.days` or `weeks[0].days` empty
- **Exact fix:** (one-liner)

## 5. Where generation is invoked

- **Draft flow:** Assign page → `generateWorkoutDraftAction(clientId, template, correlationId)` in `src/app/templates/[templateId]/assign/actions.ts` → `generateWorkoutDraft(workoutInputs, model, correlationId)` in `src/lib/services/generator.ts` → `supabase.functions.invoke("pt-workout-generator", { body: { workoutInputs, model, correlationId } })`.
- **Plan Review** reads `sessionStorage.pt_plan_draft` and passes it as `plan` to `<PlanRenderer plan={draft} />`. PlanRenderer uses `source.weeks` and `w.days` for "X day(s)".

## 6. Turning off audit

- Set `NEXT_PUBLIC_DEBUG_GENERATION=false` or remove it; restart.
- Debug panel and client/server debug logs are gated by this flag. Edge function logs run only when `correlationId` is sent (assign page sends it only when DEBUG is true).
