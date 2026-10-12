import SupervisorBoard from "@/components/SupervisorBoard";
import { requirePage } from "@/lib/auth";

export default async function Page() {
  await requirePage("cutting_supervisor");
  return <SupervisorBoard />;
}
