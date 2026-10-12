"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { useFetch } from "@/lib/useFetch";
import type { Order } from "@/lib/types";
import { ItemsTable, StatusBadge, fmt } from "./ui";

export default function SewingBoard() {
  const { data, error, reload } = useFetch<{ queue: Order[]; inAssembly: Order[] }>("/api/sewing/queue");
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function start(id: number) {
    setBusyId(id);
    setErr("");
    try {
      await api(`/api/sewing/${id}/start`, { method: "POST", body: {} });
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <h1>Sewing Queue</h1>
      <div className="muted" style={{ marginBottom: 16 }}>Only batches that passed component-by-component verification appear here.</div>
      {(err || error) && <div className="banner banner-error" role="alert">{err || error}</div>}

      {!data ? (
        <div className="muted">Loading…</div>
      ) : (
        <>
          <h2>Ready for assembly ({data.queue.length})</h2>
          {data.queue.length === 0 && <div className="card muted">No verified batches waiting.</div>}
          {data.queue.map((o) => <OrderCard key={o.id} o={o} action={<button className="btn btn-primary" disabled={busyId === o.id} onClick={() => start(o.id)}>{busyId === o.id ? "Starting…" : "Start Sewing Assembly"}</button>} />)}

          <h2 style={{ marginTop: 28 }}>In assembly ({data.inAssembly.length})</h2>
          {data.inAssembly.length === 0 && <div className="card muted">Nothing in assembly yet.</div>}
          {data.inAssembly.map((o) => <OrderCard key={o.id} o={o} />)}
        </>
      )}
    </>
  );
}

function OrderCard({ o, action }: { o: Order; action?: React.ReactNode }) {
  const approval = o.logs.find((l) => l.decision === "APPROVED");
  const earlier = o.logs.filter((l) => l.decision === "REJECTED");
  return (
    <div className="card">
      <div className="row">
        <div><h2 style={{ marginBottom: 2 }}>{o.orderNo}</h2><div className="muted">{o.recipe.name} · {o.recipe.recipeCode} · {o.targetQty} garments · roll {o.fabricRollId}</div></div>
        <StatusBadge status={o.status} />
      </div>
      {approval && (
        <div className="banner banner-ok" style={{ margin: "12px 0" }}>
          Verified by {approval.verifier.fullName} on {fmt(approval.timestamp)} · fabric wastage {approval.wastagePct}% (cap {o.recipe.wastageCap}%){o.overCap ? " · above cap" : ""}
        </div>
      )}
      {earlier.length > 0 && (
        <div className="banner banner-info">
          Verifier audit notes (earlier rejections):
          {earlier.map((l) => <div key={l.id}>{fmt(l.timestamp)} · {l.verifier.fullName}: {l.rejectionNote}</div>)}
        </div>
      )}
      <ItemsTable items={o.items} />
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
