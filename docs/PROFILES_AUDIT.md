# Profiles row creation – audit

## How profile rows are created today

| Method | Used? | Notes |
|--------|--------|--------|
| **Postgres trigger** | **Yes** | `on_auth_user_created` (AFTER INSERT on `auth.users`) runs `public.handle_new_user()`. Creates one row per new user with `id` only. Function is SECURITY DEFINER and uses `SET LOCAL row_security = off` so RLS does not block the insert. |
| **Edge function** | No | No Supabase Edge Function creates or inserts into `public.profiles` on signup. |
| **Client insert** | No | App and API only SELECT/UPDATE/upsert existing profile rows (e.g. billing webhook, profile page). No client or server code that inserts a new profile row for signup. |
| **Other** | No | None. |

**Conclusion:** Profile rows are created **only** by the trigger on `auth.users` INSERT. The trigger currently inserts only `id`; it does not set `email`.

---

## Schema: public.profiles

- **id** – uuid, PRIMARY KEY, references `auth.users(id)` ON DELETE CASCADE.
- **email** – text, nullable; added in `20260220100000_profiles_email_and_trigger_upsert.sql`, populated by trigger from `auth.users.email` (not from user metadata).

---

## Verification query (after migration)

Run in Supabase SQL Editor to confirm last 10 profiles have email set and match `auth.users`:

```sql
SELECT p.id,
       p.email AS profile_email,
       u.email AS auth_email,
       (p.email IS NOT DISTINCT FROM u.email) AS match
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.email IS NOT NULL
ORDER BY p.id DESC
LIMIT 10;
```
