import { notFound } from "next/navigation";
import VerifierTerminal from "@/components/VerifierTerminal";
import { requirePage } from "@/lib/auth";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("cutting_verifier");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <VerifierTerminal id={Number(id)} />;
}
