# Creem payment setup

Everything is wired for [Creem](https://creem.io) as merchant of record. When your
keys and MCP access arrive, fill in the environment variables and create the two
products — no code changes required.

## 1. Environment variables

Copy `.env.example` → `.env.local` and fill in:

| Variable | Where to find it | Notes |
|---|---|---|
| `CREEM_MODE` | — | `test` while under review, `live` after approval |
| `CREEM_API_KEY` | Creem → Developers → API Keys | Sent as `x-api-key` |
| `CREEM_WEBHOOK_SECRET` | Creem → Developers → Webhooks | Verifies `creem-signature` (HMAC-SHA256) |
| `CREEM_PRODUCT_ID_MONTHLY` | Product you create for $10/mo | 3-day free trial enabled on the product |
| `CREEM_PRODUCT_ID_YEARLY` | Product you create for $60/yr | |
| `CREEM_MODERATION_ENABLED` | — | `true` to enforce moderation (required for AI products) |
| `CREEM_MODERATION_API_KEY` | Creem moderation | Optional; defaults to `CREEM_API_KEY` |

## 2. Create the products in Creem

- **AI Copilot — Monthly**: recurring, **$10 / month**, **3-day free trial**.
- **AI Copilot — Yearly**: recurring, **$60 / year**.

Paste each product id into the matching env var.

## 3. Configure the webhook

Point a Creem webhook at:

```
https://shiftcut.verblike.com/api/creem/webhook
```

Subscribe to subscription lifecycle events (active, paid, trialing, canceled,
expired, past_due) and refunds. Copy the signing secret into `CREEM_WEBHOOK_SECRET`.

## 4. What's implemented

| Piece | File |
|---|---|
| Gateway client (checkout, portal, signature verify) | `src/lib/creem.ts` |
| Subscription state + `aiActive()` | `src/lib/subscription.ts` |
| Moderation wrapper (mandatory for AI) | `src/lib/moderation.ts` |
| Create checkout | `src/app/api/creem/checkout/route.ts` |
| Webhook receiver | `src/app/api/creem/webhook/route.ts` |
| Billing portal link | `src/app/api/creem/portal/route.ts` |
| Pricing page | `src/app/pricing/page.tsx` |
| Success page (checkout `success_url`) | `src/app/billing/success/page.tsx` |
| Moderation in AI proxy | `src/app/api/chat/route.ts` |

## 5. Before going live — TODO

- [ ] Replace the in-memory `SubscriptionStore` in `src/lib/subscription.ts` with a
      durable adapter (KV/Postgres). It currently resets on redeploy.
- [ ] Add a lightweight account/session so `aiActive()` can gate the in-editor chat
      per user (webhook already records status by email + customer id).
- [ ] Confirm the exact Creem moderation endpoint/response shape against the current
      API and adjust `src/lib/moderation.ts` if needed.
- [ ] Flip `CREEM_MODE=live` and `CREEM_MODERATION_ENABLED=true`.

## Creem account-review checklist → where it's satisfied

| Requirement | Where |
|---|---|
| Clear, findable pricing | `/pricing` (linked in nav + footer) |
| Privacy Policy | `/legal/privacy` |
| Terms of Service | `/legal/terms` |
| Refund / cancellation policy | `/legal/refund` |
| Reachable support email shown on site | Footer on every page (`shiftcut@verblike.com`) |
| Understandable product | Home + pricing describe the editor and AI Copilot |
| Cancel available in-product | Billing portal link (Creem) + documented on pricing/refund |
| AI moderation integrated | `src/lib/moderation.ts`, enforced in the chat proxy |
| No prohibited categories | Video editing tool — none of Creem's prohibited items |
