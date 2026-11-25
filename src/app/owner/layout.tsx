import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import OwnerNav from "@/components/OwnerNav";
import SessionWatcher from "@/components/SessionWatcher";
import { getValidSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const valid = await getValidSession();
  if (!valid) {
    redirect("/login");
  }
  if (valid.branch.role !== "owner") {
    redirect("/branch/register");
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F7F4EE] print:min-h-0 print:bg-white">
      <SessionWatcher
        sessionId={valid.session.id}
        deviceId={valid.device?.id ?? null}
        isApproved={true}
      />
      <OwnerNav
        deviceLabel={
          valid.device?.device_label ??
          (valid.is_dev ? "DEV Sandbox Session" : "Owner Session")
        }
        isDev={valid.is_dev}
      />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}
