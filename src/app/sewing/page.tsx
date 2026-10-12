import SewingBoard from "@/components/SewingBoard";
import { requirePage } from "@/lib/auth";

export default async function Page() {
  await requirePage("sewing_supervisor");
  return <SewingBoard />;
}
