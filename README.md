# ApparelFlow ERP · Cutting Operations & Gatekeeper Verification Terminal

Full-stack implementation of the Webtezza challenge: a server-enforced checkpoint that stops any unverified,
mismatched or shortage cutting batch from entering the Sewing Queue.

**Live URL:** https://apparelflow.netlify.app  · 
**Repo:** https://github.com/Farwes-Code/ApparelFlow-cutting-gate

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Cutting Supervisor | supervisor@apparelflow.test | Cutting@123 |
| Cutting Verifier | verifier@apparelflow.test | Verify@123 |
| Sewing Supervisor | sewing@apparelflow.test | Sewing@123 |

The login page has a one-click demo panel, and the header has a **Role switcher** (it performs a real login).

## Stack

Next.js (App Router, TypeScript) · Prisma + PostgreSQL (Neon) · JWT session cookie (jose, httpOnly) · bcryptjs · zod · Vitest · netlify.

## Architecture

```
src/lib/domain.ts    pure rules: traffic light, multiplier, wastage %, gate decision, zod input schemas
src/lib/service.ts   database operations and the state machine (all transitions are compare-and-set)
src/lib/auth.ts      JWT sign/verify, identity read from the signed cookie only
src/lib/api.ts       handle([roles], fn): 401 / 403 / error mapping for every protected endpoint
src/app/api/**       thin route handlers
src/components/**    role screens (supervisor, verifier terminal, sewing queue)
```

State machine: `PENDING_VERIFICATION → VERIFIED → SEWING_STARTED`, or `PENDING_VERIFICATION → REJECTED → (resubmit) → PENDING_VERIFICATION`.
Each transition is an `updateMany({ where: { id, status: <expected current> } })`, so an order can never skip or repeat a step,
even with concurrent requests.

## Security rules (all server-side)

| Rule | Where | Result |
|---|---|---|
| Wrong role calls a protected endpoint | `handle()` | `403` (`401` if not logged in) |
| Approve with any RED / missing / uncounted component | `approveOrder` + `gateDecision` | `422`, order stays pending |
| Reject without a reason | `rejectSchema` | `422` |
| Sewing queue | `getSewingQueue` | `WHERE status = 'VERIFIED'` in the query, no URL params involved |
| Verifier id / timestamp | session + server clock | request body is ignored on approve |
| Traffic-light colour | `saveCounts` | computed on the server; approval re-derives it from the raw counts |
| Bad input | zod | negatives, decimals, strings, empty payloads rejected (`422` / `400`) |

Test it directly, for example:

```bash
# as supervisor (cookie from a supervisor login) -> 403
curl -i -X POST https://<app>/api/orders/1/approve -b "af_session=<supervisor token>"
```

## API

| Method | Path | Roles |
|---|---|---|
| POST | /api/auth/login, /api/auth/logout | public |
| GET | /api/recipes | supervisor, verifier |
| GET / POST | /api/orders | GET: supervisor, verifier · POST: supervisor |
| GET | /api/orders/:id | supervisor, verifier |
| POST | /api/orders/:id/counts, /approve, /reject | verifier |
| POST | /api/orders/:id/resubmit | supervisor |
| GET | /api/sewing/queue | sewing supervisor |
| POST | /api/sewing/:id/start | sewing supervisor |

## Database schema

`users`, `recipes`, `recipe_components`, `cutting_orders`, `verification_items`, `verification_logs` (Prisma models: `User`, `Recipe`,
`RecipeComponent`, `CuttingOrder`, `VerificationItem`, `VerificationLog`). See `prisma/schema.prisma`.
On approval the log row stores verifier id, timestamp and fabric wastage %; the per-component expected/actual counts (variances)
live in `verification_items`, which the API no longer allows to change once the order leaves `PENDING_VERIFICATION`.

### Pre-seeded Recipes (BOM)
- **REC-BL01 ("Casual Blouse"):** Std Fabric: 1.8 yds/pc | Wastage Cap: 5.0% | 5 Components (Front, Back, Sleeves x2, Collar, Cuffs x2)
- **REC-CT02 ("Crop Top"):** Std Fabric: 1.1 yds/pc | Wastage Cap: 8.0% | 5 Components (Front Chest, Back Support, Neck Binding, Hem Casing, Side Straps x2)

## Run locally

```bash
npm install --legacy-peer-deps
cp .env.example .env        # fill DATABASE_URL and JWT_SECRET
npx prisma db push
npm run seed
npm run dev
npm test
```

## Deploy (Netlify)

Import the GitHub repo, set `DATABASE_URL` and `JWT_SECRET` as environment variables, deploy. `postinstall` runs `prisma generate`.

## AI Optimization Report
Refer to `AI_OPTIMIZATION_REPORT.md` in the root repository for technical candor regarding AI usage, hallucinations caught, human code refactoring, and defensive system boundary hardening.
