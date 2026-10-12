import type { Role } from "@prisma/client";

export const ROLE_LABEL: Record<Role, string> = {
  cutting_supervisor: "Cutting Supervisor",
  cutting_verifier: "Cutting Verifier",
  sewing_supervisor: "Sewing Supervisor",
};

export function homeFor(role: Role): string {
  return { cutting_supervisor: "/supervisor", cutting_verifier: "/verifier", sewing_supervisor: "/sewing" }[role];
}

export const isRole = (r: unknown): r is Role => typeof r === "string" && r in ROLE_LABEL;
