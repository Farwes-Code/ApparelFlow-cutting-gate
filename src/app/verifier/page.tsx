import VerifierBoard from "@/components/VerifierBoard";
import { requirePage } from "@/lib/auth";

export default async function Page() {
  await requirePage("cutting_verifier");
  return <VerifierBoard />;
}
