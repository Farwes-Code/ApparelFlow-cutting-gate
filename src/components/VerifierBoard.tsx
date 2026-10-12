"use client";
import { useState } from "react";
import Link from "next/link";
import { useFetch } from "@/lib/useFetch";
import type { Order } from "@/lib/types";
import { StatusBadge, fmt } from "./ui";

const TABS: { key: string; label: string; match: (o: Order) => boolean }[] = [
  { key: "pending", label: "Awaiting QC", match: (o) => o.status === "PENDING_VERIFICATION" },
  { key: "verified", label: "Verified", match: (o) => o.status === "VERIFIED" || o.status === "SEWING_STARTED" },
  { key: "rejected", label: "Rejected", match: (o) => o.status === "REJECTED" },
  { key: "all", label: "All", match: () => true },
];

export default function VerifierBoard() {
  const { data, error } = useFetch<Order[]>("/api/orders");
  const [tab, setTab] = useState("pending");
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const list = (data ?? []).filter(active.match);

  return (
    <>
      <h1>Verification Terminal</h1>
      <div className="muted" style={{ marginBottom: 16 }}>Count every component. A single shortage blocks the batch from sewing.</div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className="tab" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label} ({(data ?? []).filter(t.match).length})
          </button>
        ))}
      </div>

      <div className="card">
        {!data ? (
          <div className="muted">Loading…</div>
        ) : list.length === 0 ? (
          <div className="muted">Nothing here.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Recipe</th><th className="num">Qty</th><th>Roll</th><th>Status</th><th>Submitted</th><th></th></tr></thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o.id}>
                    <td><b>{o.orderNo}</b></td>
                    <td>{o.recipe.name}</td>
                    <td className="num">{o.targetQty}</td>
                    <td>{o.fabricRollId}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="muted">{fmt(o.updatedAt)}</td>
                    <td>
                      <Link className={`btn btn-sm ${o.status === "PENDING_VERIFICATION" ? "btn-primary" : "btn-ghost"}`} href={`/verifier/${o.id}`}>
                        {o.status === "PENDING_VERIFICATION" ? "Open terminal" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
