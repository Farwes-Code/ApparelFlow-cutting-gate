"use client";
import { useState } from "react";
import type { Role } from "@prisma/client";
import { api } from "@/lib/client";
import { DEMO_USERS } from "@/lib/demo";
import { ROLE_LABEL, homeFor } from "@/lib/roles";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(e: string, p: string) {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ user: { role: Role } }>("/api/auth/login", { method: "POST", body: { email: e, password: p } });
      window.location.href = homeFor(r.user.role);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const emailErr = !email.trim() ? "Email is required" : "";
  const passErr = !password ? "Password is required" : "";

  return (
    <div className="login-wrap">
      <form
        className="card"
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          setSubmitted(true);
          if (!emailErr && !passErr) login(email, password);
        }}
      >
        <h2>Sign in</h2>
        {error && <div className="banner banner-error" role="alert">{error}</div>}
        <div className="field">
          <label className="lbl" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" value={email} aria-invalid={submitted && !!emailErr}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@apparelflow.test" />
          {submitted && emailErr && <div className="error">{emailErr}</div>}
        </div>
        <div className="field">
          <label className="lbl" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} aria-invalid={submitted && !!passErr}
            onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
          {submitted && passErr && <div className="error">{passErr}</div>}
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>

      <div>
        <h2>Demo credentials</h2>
        <p className="muted">Real accounts with real server-side role checks. One click signs you in as that persona.</p>
        {DEMO_USERS.map((d) => (
          <div className="demo" key={d.role}>
            <div className="row">
              <b>{ROLE_LABEL[d.role]}</b>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => login(d.email, d.password)}>Sign in as this role</button>
            </div>
            <div className="muted">{d.blurb}</div>
            <div style={{ marginTop: 6 }}><code>{d.email}</code> / <code>{d.password}</code></div>
          </div>
        ))}
      </div>
    </div>
  );
}
