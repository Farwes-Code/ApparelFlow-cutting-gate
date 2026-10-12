import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getSession } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export default async function Home() {
  const s = await getSession();
  if (s) redirect(homeFor(s.role));
  return (
    <>
      <h1>ApparelFlow ERP</h1>
      <div className="muted">Cutting Operations &amp; Gatekeeper Verification Terminal. No unverified batch reaches the sewing floor.</div>
      <LoginForm />
    </>
  );
}
