"use client";
import { useState } from "react";
import Link from "next/link";
import { api, isWholeNumber } from "@/lib/client";
import { useFetch } from "@/lib/useFetch";
import type { Item, Light, Order } from "@/lib/types";
import { ItemsTable, StatusBadge, TrafficLight, fmt } from "./ui";

export default function VerifierTerminal({ id }: { id: number }) {
  const { data: order, error, reload } = useFetch<Order>(`/api/orders/${id}`);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const [noteTouched, setNoteTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  if (error && !order) return <div className="banner banner-error" role="alert">{error}</div>;
  if (!order) return <div className="muted">Loading order…</div>;

  const editable = order.status === "PENDING_VERIFICATION";
  const value = (it: Item) => draft[it.componentId] ?? (it.actualQty === null ? "" : String(it.actualQty));

  // UI-only preview of the traffic light. The server recomputes everything.
  const live = (it: Item): { valid: boolean; light: Light | null } => {
    const v = value(it);
    if (!isWholeNumber(v)) return { valid: false, light: null };
    const n = Number(v);
    return { valid: true, light: n === it.expectedQty ? "GREEN" : n > it.expectedQty ? "YELLOW" : "RED" };
  };

  const states = order.items.map(live);
  const reds = states.filter((s) => s.light === "RED").length;
  const uncounted = states.filter((s) => !s.valid).length;
  const canApprove = editable && !busy && reds === 0 && uncounted === 0;
  const noteErr = note.trim().length < 5 ? "A reason of at least 5 characters is mandatory to reject" : "";

  const payload = (onlyValid: boolean) =>
    order.items
      .filter((it) => !onlyValid || live(it).valid)
      .map((it) => ({ componentId: it.componentId, actualQty: Number(value(it)) }));

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr("");
    setOk("");
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
      reload();
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      const counts = payload(true);
      if (counts.length === 0) throw new Error("Enter at least one valid whole-number count first");
      await api(`/api/orders/${id}/counts`, { method: "POST", body: { counts } });
      setOk("Counts saved.");
      reload();
    });

  const approve = () =>
    run(async () => {
      await api(`/api/orders/${id}/counts`, { method: "POST", body: { counts: payload(false) } });
      await api(`/api/orders/${id}/approve`, { method: "POST", body: {} });
      window.location.href = "/verifier";
    });

  const reject = () => {
    setNoteTouched(true);
    if (noteErr) return;
    return run(async () => {
      await api(`/api/orders/${id}/reject`, { method: "POST", body: { note: note.trim() } });
      window.location.href = "/verifier";
    });
  };

  const decision = order.logs[0];

  return (
    <>
      <Link href="/verifier">← Back to queue</Link>
      <div className="row" style={{ margin: "8px 0 16px" }}>
        <div><h1>{order.orderNo}</h1><div className="muted">{order.recipe.name} · {order.recipe.recipeCode}</div></div>
        <StatusBadge status={order.status} />
      </div>

      <div className="card">
        <div className="kv">
          <div><span>Target quantity</span><b>{order.targetQty} garments</b></div>
          <div><span>Fabric roll</span><b>{order.fabricRollId}</b></div>
          <div><span>Expected fabric</span><b>{order.expectedFabricYds} yds</b></div>
          <div><span>Actual fabric</span><b>{order.actualFabricYds} yds</b></div>
          <div><span>Wastage</span><b>{order.wastagePct}% (cap {order.recipe.wastageCap}%)</b></div>
          <div><span>Cut by</span><b>{order.creator.fullName}</b></div>
        </div>
        {order.overCap && <div className="banner banner-warn" style={{ marginTop: 12 }}>Fabric wastage is above the recipe cap. Recorded in the audit trail.</div>}
      </div>

      {err && <div className="banner banner-error" role="alert">{err}</div>}
      {ok && <div className="banner banner-ok">{ok}</div>}

      {editable ? (
        <>
          <div className="card">
            <h2>Count physical pieces</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Component</th><th className="num">Expected</th><th className="num">Counted</th><th className="num">Variance</th><th>Status</th></tr></thead>
                <tbody>
                  {order.items.map((it, i) => {
                    const s = states[i];
                    const v = value(it);
                    const bad = v !== "" && !s.valid;
                    return (
                      <tr key={it.id}>
                        <td>{it.component.componentName}<div className="muted">{it.component.piecesPerGarment} per garment</div></td>
                        <td className="num">{it.expectedQty}</td>
                        <td className="num">
                          <input className="input-sm" inputMode="numeric" aria-label={`Counted ${it.component.componentName}`} value={v} aria-invalid={bad}
                            placeholder="0" onChange={(e) => setDraft((d) => ({ ...d, [it.componentId]: e.target.value }))} />
                          {bad && <div className="error">Whole numbers only</div>}
                        </td>
                        <td className="num">{s.valid ? Number(v) - it.expectedQty : "–"}</td>
                        <td><TrafficLight status={s.light} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={save} disabled={busy}>Save counts</button>
            </div>
          </div>

          <div className="card">
            <h2>Decision</h2>
            {reds > 0 && (
              <div className="banner banner-error">Shortage on {reds} component(s). Approval is blocked. Reject the batch with a reason to send it back for re-cutting.</div>
            )}
            {reds === 0 && uncounted > 0 && <div className="banner banner-info">Count all {order.items.length} components to enable approval ({uncounted} remaining).</div>}
            {canApprove && <div className="banner banner-ok">All components match or exceed the expected count. Ready to approve.</div>}

            <div className="field">
              <label className="lbl" htmlFor="note">Rejection reason (mandatory to reject)</label>
              <textarea id="note" rows={3} maxLength={500} value={note} placeholder="e.g. Left sleeve short by 4 pieces, fabric defect on roll edge"
                aria-invalid={noteTouched && !!noteErr} onChange={(e) => setNote(e.target.value)} onBlur={() => setNoteTouched(true)} />
              {noteTouched && noteErr && <div className="error">{noteErr}</div>}
            </div>
            <div className="row">
              <button className="btn btn-danger" onClick={reject} disabled={busy}>Reject Batch</button>
              <button className="btn btn-ok" onClick={approve} disabled={!canApprove} title={canApprove ? "" : "Disabled until every component is counted and none is short"}>Approve Batch</button>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <h2>Result</h2>
          <ItemsTable items={order.items} />
          {decision && (
            <div className="banner banner-info" style={{ marginTop: 12 }}>
              {decision.decision} by {decision.verifier.fullName} on {fmt(decision.timestamp)} · wastage {decision.wastagePct}%
              {decision.rejectionNote && <div>Reason: {decision.rejectionNote}</div>}
            </div>
          )}
        </div>
      )}
    </>
  );
}
