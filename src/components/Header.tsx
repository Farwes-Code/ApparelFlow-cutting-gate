"use client";
import { useState } from "react";
import type { Role } from "@prisma/client";
import { api } from "@/lib/client";
import { DEMO_USERS } from "@/lib/demo";
import { ROLE_LABEL, homeFor } from "@/lib/roles";

export default function Header({ user }: { user: { name: string; role: Role } | null }) {
  const [busy, setBusy] = useState(false);

  async function switchRole(role: Role) {
    const demo = DEMO_USERS.find((d) => d.role === role);
    if (!demo) return;
    setBusy(true);
    try {
      await api("/api/auth/login", { method: "POST", body: { email: demo.email, password: demo.password } });
      window.location.href = homeFor(role);
    } catch {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/";
  }

  return (
    <header className="header">
      <div className="brand">Apparel<span>Flow</span> ERP · Cutting Gate</div>
      {user && (
        <div className="header-right">
          <label htmlFor="role-switch">Role switcher</label>
          <select id="role-switch" value={user.role} disabled={busy} onChange={(e) => switchRole(e.target.value as Role)}>
            {DEMO_USERS.map((d) => (
              <option key={d.role} value={d.role}>{ROLE_LABEL[d.role]}</option>
            ))}
          </select>
          <span>{user.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout} disabled={busy}>Sign out</button>
        </div>
      )}
    </header>
  );
}
