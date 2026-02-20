# Meta (Facebook) Pixel

Meta Pixel is loaded globally via the root layout and tracks:

- **PageView** – fired once on initial load (in the script).
- **Lead** – fired when signup completes (after verify-otp success in `EmailCodeModal`).
- **StartTrial** – fired once when the user lands on the Stripe success page with `subscription_status === "trial"`.
- **Purchase** – fired once when the user lands on the Stripe success page with `subscription_status === "active"` (paid conversion only).

## Environment variable

Set in `.env.local` (or your deployment env):

```bash
NEXT_PUBLIC_META_PIXEL_ID=YOUR_PIXEL_ID
```

Do not hardcode the pixel ID. The script in `src/app/layout.tsx` reads this at build time.

## Implementation details

- Pixel is injected with `next/script` and `strategy="afterInteractive"` so it does not block SSR or cause hydration issues.
- All event calls use `lib/meta.ts` → `trackMetaEvent()`, which only runs in the browser and guards on `window.fbq`.
- StartTrial and Purchase are fired from the client component `StripeSuccessPixel` on the tutorial page; `sessionStorage` is used so each event fires only once per checkout session.
