# Plan share / email share configuration

The "email share" (sending a plan to a client via email) and share links require these environment variables.

## Required

- **PLAN_SHARE_SECRET** – Secret used to sign and verify share tokens (plan/meal share links). Use a long random string (e.g. 32+ chars). Set in Vercel → Project → Settings → Environment Variables.
- **RESEND_API_KEY** – Resend API key for sending the "Your plan is ready" email. Set in Vercel and in `.env.local` for local dev.
- **NEXT_PUBLIC_APP_URL** – App origin (e.g. `https://milo-hub-lac.vercel.app`). Used to build share URLs in the email.

If **PLAN_SHARE_SECRET** is missing, the API returns **500 "Share not configured"** when generating share links or sending the plan email.

## Generate a secret

```bash
# Example: 32-byte hex secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add the output as `PLAN_SHARE_SECRET` in Vercel (and `.env.local` for local).
