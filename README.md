# ApparelFlow ERP - Production Verification & Sewing Queue Gate

A mission-critical Full-Stack ERP module engineered for garment manufacturing to enforce zero-defect transitions from the Cutting Department to the Sewing Assembly Line.

## 🚀 Live Demo & Deployment
- **Live URL:** https://apparelflow.netlify.app/
- **Repository:** https://github.com/Farwes-Code/ApparelFlow-cutting-gate.git

## 🔑 Demo Credentials / Role Switcher
| Role | Email / Switcher | Permissions |
| :--- | :--- | :--- |
| **Cutting Supervisor** | `supervisor@apparelflow.com` | Create batches, calculate multipliers, log fabric yards. Cannot verify. |
| **Cutting Verifier** | `verifier@apparelflow.com` | Traffic-light component counting, digital sign-off, rejection flow. |
| **Sewing Supervisor** | `sewing@apparelflow.com` | Isolated queue viewing verified batches only. |

## 🛠️ Tech Stack & Architecture
- **Framework:** Next.js (App Router) / React + Node.js
- **Database:** PostgreSQL / Supabase / SQLite with persistent schema
- **State Engine:** Deterministic State Machine (`CUTTING_IN_PROGRESS` -> `PENDING_VERIFICATION` -> `VERIFIED` / `REJECTED`)
- **Testing:** Vitest / Jest (Integration & API boundary tests)

## 🛡️ Security & Hard-Stop Implementation
- **Server-Side Hard Stop:** API blocks batch approval with `422 Unprocessable Entity` if any component has a shortage (`RED`).
- **RBAC Boundaries:** Direct unauthorized API attempts return `403 Forbidden`.
- **Query Isolation:** `GET /api/sewing/queue` strictly queries `WHERE status = 'VERIFIED'` at DB level.
