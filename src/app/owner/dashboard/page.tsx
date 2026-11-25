import OwnerDashboardClient from "@/components/OwnerDashboardClient";
import { queryOwnerDashboardData } from "@/lib/owner/audit";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage() {
  const data = await queryOwnerDashboardData();
  return <OwnerDashboardClient data={data} />;
}
