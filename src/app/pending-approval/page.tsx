import { redirect } from "next/navigation";
import { Clock, LogOut, Monitor } from "lucide-react";
import SessionWatcher from "@/components/SessionWatcher";
import {
  getBranchDisplayName,
  getDefaultRedirect,
  getValidSession,
  isSessionApproved,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PendingApprovalPage() {
  const valid = await getValidSession();
  if (!valid) {
    redirect("/login");
  }

  const isApproved = isSessionApproved(valid);
  if (isApproved) {
    redirect(getDefaultRedirect(valid.branch.role, true));
  }

  const branchDisplay = getBranchDisplayName(valid.branch);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4EE] px-4 py-12">
      <SessionWatcher
        sessionId={valid.session.id}
        deviceId={valid.device?.id ?? null}
        isApproved={false}
      />

      <div className="w-full max-w-lg rounded-xl border border-[#DFD7C8] bg-white p-6 shadow-xs sm:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-full bg-[#1B2A4A] px-3 py-1 text-xs font-semibold text-[#F4DDA8]">
            {branchDisplay}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF6A]/60 bg-[#FBF5E8] px-3 py-1 text-xs font-medium text-[#7D5B1C]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#B48A3E]" />
            Waiting for Approval
          </span>
        </div>

        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#D4AF6A]/40 bg-[#FBF5E8] text-[#9A722C]">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold text-[#1B2A4A]">
              Device Pending Owner Approval
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              This computer is recognized for <strong>{branchDisplay}</strong>{" "}
              but has not been approved yet. Please wait—this page will
              redirect automatically as soon as the owner approves this device.
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-[#E3DCCD] bg-[#FAF7F1] p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium text-slate-800">
            <Monitor className="h-4 w-4 text-slate-500" />
            <span>Detected Computer Details</span>
          </div>
          <dl className="grid grid-cols-1 gap-2 text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-slate-500">
                Branch
              </dt>
              <dd className="font-medium text-[#1B2A4A]">{branchDisplay}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-slate-500">
                Device Label
              </dt>
              <dd className="font-medium text-[#1B2A4A]">
                {valid.device?.device_label ?? "Unlabeled Device"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-slate-500">
                Operating System
              </dt>
              <dd className="font-mono text-xs font-medium text-slate-800">
                {valid.device?.os_name ?? valid.session.os_info ?? "Unknown"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-slate-500">
                Browser
              </dt>
              <dd className="font-mono text-xs font-medium text-slate-800">
                {valid.device?.browser_name ??
                  valid.session.browser_info ??
                  "Unknown"}
              </dd>
            </div>
          </dl>
        </div>

        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#D8D0C0] bg-white px-4 py-2 text-sm font-semibold text-[#1B2A4A] transition hover:bg-[#FAF7F1] sm:w-auto"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </form>
      </div>
    </main>
  );
}
