# AI Optimization Report

> DRAFT. Every line marked **[EDIT]** must be replaced with what you actually saw and did.
> Read the code before submitting; the evaluators will ask about it. Delete this note when done.

## 1. Tools & Prompting

- Claude (chat) was used for: project scaffolding steps, Prisma schema design, the seed script, API route structure,
  the server-side role/validation layer, the React screens and CSS, and the Vitest suites.
- Workflow: I described the brief, Claude proposed the stack and a 4-day plan, then generated code in steps while I ran every
  command on my machine and reported errors back (screenshots of terminal output).
- **[EDIT]** Add any other tools (Copilot, ChatGPT, v0) and the prompts that worked best.

## 2. Flawed / Broken AI Code

1. **Prisma version mismatch.** The AI told me to pin `prisma@6`, but `npx prisma init` ran the latest CLI and generated a
   v7-style `prisma.config.ts` plus a client output folder under `src/generated`. The pinned install had also failed on a peer
   dependency conflict, so the CLI and client versions did not match and `db push` first targeted a dummy
   `localhost` URL. Fix: reinstall with `--legacy-peer-deps`, delete `prisma.config.ts`, remove the custom `output`, run `prisma generate`.
2. **Dev-tooling gap in the first test setup.** Vitest needs `vite`, which `--legacy-peer-deps` skipped, so `npm test` failed to start
   until `vite` was installed explicitly.
3. **[EDIT]** Add at least one *code-level* flaw you find while reviewing. Things worth checking in this codebase:
   client-side-only disabling of "Approve Batch" (the server must still return 422), trusting a client-supplied verifier id,
   colour status stored from the client, `Number("")` coercing to `0`, white-on-white inputs, effect loops in the data hooks.

## 3. Human Refactoring

- **[EDIT]** Describe what you changed yourself after reading the generated code (e.g. renamed things, tightened validation, moved logic).
- Hardening decisions I verified: status colours are recomputed on the server from raw counts at approval time; every
  state transition is a compare-and-set `updateMany`; the approve endpoint ignores the request body; inputs use `inputMode` text with
  explicit regex checks instead of `type="number"` (which accepts `e`, `-` and decimals); all form controls have explicit dark-on-light colours for every state.

## 4. Defensive Architecture

- One wrapper (`handle([...roles], fn)`) guards every protected endpoint: `401` without a valid signed session, `403` for the wrong role.
- Business rules live in `src/lib/domain.ts` (pure, unit-tested) and `src/lib/service.ts` (database, transactional).
- Hard stop: `approveOrder` runs inside a transaction, re-derives pass/fail from raw counts, returns `422` on any RED / uncounted
  component, then performs a compare-and-set to `VERIFIED` and writes the audit row (verifier id from the session, server timestamp, wastage %).
- Sewing isolation: `getSewingQueue` filters `status = 'VERIFIED'` in the database query; the sewing role has no endpoint that returns other orders.
- Tests call the real route handlers, so the 401/403/422 contract is exercised, not just the helper functions.
