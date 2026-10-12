import type { Role } from "@prisma/client";

// Public demo credentials (also listed in README). Seeded by prisma/seed.ts.
export const DEMO_USERS: { role: Role; email: string; password: string; blurb: string }[] = [
  { role: "cutting_supervisor", email: "supervisor@apparelflow.test", password: "Cutting@123", blurb: "Creates cutting orders, logs fabric, resubmits rejected batches." },
  { role: "cutting_verifier", email: "verifier@apparelflow.test", password: "Verify@123", blurb: "Counts parts, sees traffic lights, approves or rejects batches." },
  { role: "sewing_supervisor", email: "sewing@apparelflow.test", password: "Sewing@123", blurb: "Sees verified batches only and starts sewing assembly." },
];
