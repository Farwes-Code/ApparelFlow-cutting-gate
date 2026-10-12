"use client";
import { useState } from "react";
import { api, isWholeNumber } from "@/lib/client";
import { useFetch } from "@/lib/useFetch";
import type { Order, Recipe } from "@/lib/types";
import { StatusBadge, fmt } from "./ui";

export default function SupervisorBoard() {
  const orders = useFetch<Order[]>("/api/orders");
  const recipes = useFetch<Recipe[]>("/api/recipes");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function resubmit(id: number) {
    setErr("");
    setMsg("");
    try {
      await api(`/api/orders/${id}/resubmit`, { method: "POST", body: {} });
      setMsg("Order re-cut and sent back to the verifier.");
      orders.reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const list = orders.data ?? [];
  const count = (s: Order["status"]) => list.filter((o) => o.status === s).length;

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <div>
          <h1>Cutting Orders</h1>
          <div className="muted">Create batches from recipes, log fabric used, and track them through QC.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)} disabled={!recipes.data}>+ New Cutting Order</button>
      </div>

      {(err || orders.error) && <div className="banner banner-error" role="alert">{err || orders.error}</div>}
      {msg && <div className="banner banner-ok">{msg}</div>}

      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="stat"><span className="muted">Pending verification</span><b>{count("PENDING_VERIFICATION")}</b></div>
        <div className="stat"><span className="muted">Rejected (needs re-cut)</span><b>{count("REJECTED")}</b></div>
        <div className="stat"><span className="muted">Verified</span><b>{count("VERIFIED")}</b></div>
        <div className="stat"><span className="muted">In sewing</span><b>{count("SEWING_STARTED")}</b></div>
      </div>

      <div className="card">
        {!orders.data ? (
          <div className="muted">Loading orders…</div>
        ) : list.length === 0 ? (
          <div className="muted">No cutting orders yet. Create the first one.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Order</th><th>Recipe</th><th className="num">Qty</th><th>Fabric roll</th><th className="num">Fabric (yds)</th><th>Status</th><th>Created</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((o) => {
                  const rej = o.logs.find((l) => l.decision === "REJECTED");
                  return (
                    <tr key={o.id}>
                      <td><b>{o.orderNo}</b></td>
                      <td>{o.recipe.name}<div className="muted">{o.recipe.recipeCode}</div></td>
                      <td className="num">{o.targetQty}</td>
                      <td>{o.fabricRollId}</td>
                      <td className="num">{o.actualFabricYds}</td>
                      <td>
                        <StatusBadge status={o.status} />
                        {o.status === "REJECTED" && rej?.rejectionNote && (
                          <div className="error" style={{ maxWidth: 260 }}>Reason: {rej.rejectionNote}</div>
                        )}
                      </td>
                      <td className="muted">{fmt(o.createdAt)}</td>
                      <td>{o.status === "REJECTED" && <button className="btn btn-ghost btn-sm" onClick={() => resubmit(o.id)}>Re-cut &amp; resubmit</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && recipes.data && (
        <NewOrderModal
          recipes={recipes.data}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            setMsg("Cutting order submitted for verification.");
            orders.reload();
          }}
        />
      )}
    </>
  );
}

function NewOrderModal({ recipes, onClose, onCreated }: { recipes: Recipe[]; onClose: () => void; onCreated: () => void }) {
  const [recipeId, setRecipeId] = useState("");
  const [qty, setQty] = useState("");
  const [roll, setRoll] = useState("");
  const [fabric, setFabric] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErr, setServerErr] = useState("");
  const [busy, setBusy] = useState(false);

  const errors: Record<string, string> = {
    recipeId: recipeId ? "" : "Select a recipe",
    qty: isWholeNumber(qty) && Number(qty) >= 1 ? "" : "Enter a whole number, 1 or more (no decimals, negatives or text)",
    roll: roll.trim() ? "" : "Fabric roll ID is required",
    fabric: /^\d+(\.\d{1,2})?$/.test(fabric.trim()) && Number(fabric) > 0 ? "" : "Enter yards greater than 0 (up to 2 decimals)",
  };
  const show = (k: string) => (touched[k] || submitted) && errors[k];
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const recipe = recipes.find((r) => String(r.id) === recipeId);
  const qtyOk = !errors.qty;

  async function submit() {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    setServerErr("");
    try {
      await api("/api/orders", {
        method: "POST",
        body: { recipeId: Number(recipeId), targetQty: Number(qty), fabricRollId: roll.trim(), actualFabricYds: Number(fabric) },
      });
      onCreated();
    } catch (e) {
      setServerErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-label="New cutting order">
      <div className="modal">
        <div className="row"><h2>New Cutting Order</h2><button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button></div>
        {serverErr && <div className="banner banner-error" role="alert">{serverErr}</div>}

        <div className="field">
          <label className="lbl" htmlFor="recipe">Recipe</label>
          <select id="recipe" value={recipeId} aria-invalid={!!show("recipeId")} onChange={(e) => setRecipeId(e.target.value)} onBlur={() => touch("recipeId")}>
            <option value="">Select a recipe…</option>
            {recipes.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.recipeCode})</option>)}
          </select>
          {show("recipeId") && <div className="error">{errors.recipeId}</div>}
        </div>

        <div className="field">
          <label className="lbl" htmlFor="qty">Target batch quantity (garments)</label>
          <input id="qty" inputMode="numeric" value={qty} placeholder="e.g. 50" aria-invalid={!!show("qty")}
            onChange={(e) => setQty(e.target.value)} onBlur={() => touch("qty")} />
          {show("qty") && <div className="error">{errors.qty}</div>}
        </div>

        <div className="field">
          <label className="lbl" htmlFor="roll">Fabric roll ID</label>
          <input id="roll" value={roll} maxLength={40} placeholder="e.g. FAB-ROLL-882" aria-invalid={!!show("roll")}
            onChange={(e) => setRoll(e.target.value)} onBlur={() => touch("roll")} />
          {show("roll") && <div className="error">{errors.roll}</div>}
        </div>

        <div className="field">
          <label className="lbl" htmlFor="fabric">Actual fabric used (yards)</label>
          <input id="fabric" inputMode="decimal" value={fabric} placeholder="e.g. 92.5" aria-invalid={!!show("fabric")}
            onChange={(e) => setFabric(e.target.value)} onBlur={() => touch("fabric")} />
          {show("fabric") && <div className="error">{errors.fabric}</div>}
        </div>

        {recipe && (
          <div className="card" style={{ background: "#f8fafc" }}>
            <b>Expected component counts</b>
            <div className="muted">Standard fabric: {recipe.stdFabricYards} yds/piece · wastage cap {recipe.wastageCap}%
              {qtyOk && ` · expected fabric ${(Number(qty) * recipe.stdFabricYards).toFixed(2)} yds`}</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Component</th><th className="num">Per garment</th><th className="num">Expected</th></tr></thead>
                <tbody>
                  {recipe.components.map((c) => (
                    <tr key={c.id}><td>{c.componentName}</td><td className="num">{c.piecesPerGarment}</td><td className="num">{qtyOk ? Number(qty) * c.piecesPerGarment : "–"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="row">
          <span className="muted">Submitting sends the batch to QC.</span>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit for verification"}</button>
        </div>
      </div>
    </div>
  );
}
