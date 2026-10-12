import type { Item, Light } from "@/lib/types";

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status.replace(/_/g, " ")}</span>;
}

export function TrafficLight({ status }: { status: Light | null }) {
  if (!status) return <span className="badge badge-NONE">UNCOUNTED</span>;
  const label = { GREEN: "GREEN · MATCH", YELLOW: "YELLOW · EXCESS", RED: "RED · SHORTAGE" }[status];
  return <span className={`badge badge-${status}`}>{label}</span>;
}

export const fmt = (d: string) => new Date(d).toLocaleString();

export function ItemsTable({ items }: { items: Item[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Component</th>
            <th className="num">Expected</th>
            <th className="num">Counted</th>
            <th className="num">Variance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const v = it.actualQty === null ? null : it.actualQty - it.expectedQty;
            return (
              <tr key={it.id}>
                <td>{it.component.componentName}</td>
                <td className="num">{it.expectedQty}</td>
                <td className="num">{it.actualQty ?? "–"}</td>
                <td className="num">{v === null ? "–" : v > 0 ? `+${v}` : v}</td>
                <td><TrafficLight status={it.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
