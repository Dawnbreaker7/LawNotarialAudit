import { redirect } from "next/navigation";
import OwnerDevicesClient from "@/components/OwnerDevicesClient";
import { fetchOwnerDevicesSnapshot } from "@/lib/owner/devices";
import { getValidSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function OwnerDevicesPage() {
  const valid = await getValidSession();
  if (!valid || valid.branch.role !== "owner") {
    redirect("/login");
  }

  const snapshot = await fetchOwnerDevicesSnapshot();

  return (
    <OwnerDevicesClient
      initialBranches={snapshot.branches}
      initialDevices={snapshot.devices}
      initialSessions={snapshot.activeSessions}
      currentSessionId={valid.session.id}
      currentDeviceId={valid.device?.id ?? null}
    />
  );
}
