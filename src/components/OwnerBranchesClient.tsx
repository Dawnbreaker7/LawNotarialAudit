"use client";

import { useState, type FormEvent } from "react";
import {
  Building2,
  CheckCircle2,
  Download,
  KeyRound,
  Save,
  ShieldAlert,
  X,
} from "lucide-react";
import type { OwnerBranchConfig } from "@/lib/owner/branches";

interface OwnerBranchesClientProps {
  initialBranches: OwnerBranchConfig[];
}

interface BranchDraft {
  max_devices: string;
  allow_mobile_login: boolean;
  require_device_approval: boolean;
  new_password: string;
}

export default function OwnerBranchesClient({
  initialBranches,
}: OwnerBranchesClientProps) {
  const [branches, setBranches] =
    useState<OwnerBranchConfig[]>(initialBranches);
  const [drafts, setDrafts] = useState<Record<string, BranchDraft>>(() => {
    const map: Record<string, BranchDraft> = {};
    for (const b of initialBranches) {
      map[b.id] = {
        max_devices: String(b.max_devices),
        allow_mobile_login: b.allow_mobile_login,
        require_device_approval: b.require_device_approval,
        new_password: "",
      };
    }
    return map;
  });

  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSaveBranch(e: FormEvent, branch: OwnerBranchConfig) {
    e.preventDefault();
    const draft = drafts[branch.id];
    if (!draft) return;

    const maxDevices = Number(draft.max_devices);
    if (!Number.isInteger(maxDevices) || maxDevices < 1 || maxDevices > 20) {
      setErrorMsg("Max approved PCs must be a whole number between 1 and 20.");
      return;
    }

    if (draft.new_password && draft.new_password.length < 6) {
      setErrorMsg("New branch password must be at least 6 characters.");
      return;
    }

    setSavingId(branch.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/owner/branches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: branch.id,
          max_devices: maxDevices,
          allow_mobile_login: draft.allow_mobile_login,
          require_device_approval: draft.require_device_approval,
          ...(draft.new_password ? { new_password: draft.new_password } : {}),
        }),
      });

      const data = (await res.json()) as {
        branch?: OwnerBranchConfig;
        error?: string;
      };
      if (!res.ok || !data.branch) {
        setErrorMsg(data.error ?? "Failed to update branch settings.");
        return;
      }

      setBranches((prev) =>
        prev.map((b) =>
          b.id === branch.id
            ? {
                ...b,
                ...data.branch,
              }
            : b
        )
      );
      setDrafts((prev) => ({
        ...prev,
        [branch.id]: {
          ...prev[branch.id],
          new_password: "",
        },
      }));
      setSuccessMsg(
        `Saved settings for ${branch.display_name}${draft.new_password ? " (password updated)" : ""}.`
      );
    } catch {
      setErrorMsg("Network error while updating branch settings.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1B2A4A]">
            Branch Security &amp; Access Settings
          </h1>
          <p className="text-sm text-slate-600">
            Manage login passwords, maximum approved computers, and mobile access
            policies for GenSan Branch and Malungon Branch.
          </p>
        </div>

        <a
          href="/api/owner/backup"
          download
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#D8D0C0] bg-white px-4 py-2 text-sm font-semibold text-[#1B2A4A] transition hover:bg-[#FAF7F1] sm:w-auto"
        >
          <Download className="h-4 w-4 text-[#9A722C]" />
          Download Full System Backup (.json)
        </a>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {branches.map((branch) => {
          const draft = drafts[branch.id];
          if (!draft) return null;

          return (
            <form
              key={branch.id}
              onSubmit={(e) => void handleSaveBranch(e, branch)}
              className="rounded-xl border border-[#DFD7C8] bg-white p-6 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE3D5] pb-4">
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-5 w-5 text-[#9A722C]" />
                  <div>
                    <h2 className="font-serif text-lg font-bold text-[#1B2A4A]">
                      {branch.display_name}
                    </h2>
                    <div className="font-mono text-xs text-slate-500">
                      Login Code: {branch.branch_code}
                    </div>
                  </div>
                </div>

                <span className="rounded-full border border-[#DFD7C8] bg-[#FAF7F1] px-3 py-1 font-mono text-xs font-semibold tabular-nums text-[#1B2A4A]">
                  {branch.approved_device_count} / {branch.max_devices} PCs
                  approved
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-600">
                    <KeyRound className="h-3.5 w-3.5" />
                    Reset Branch Password (Optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Leave blank to keep existing password"
                    value={draft.new_password}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [branch.id]: {
                          ...prev[branch.id],
                          new_password: e.target.value,
                        },
                      }))
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 text-base placeholder:text-slate-500 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Minimum 6 characters if changing password.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Max Approved Devices (PCs)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={draft.max_devices}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [branch.id]: {
                          ...prev[branch.id],
                          max_devices: e.target.value,
                        },
                      }))
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 font-mono text-base tabular-nums focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>

                <div className="space-y-1 rounded-lg border border-[#EAE3D5] bg-[#FAF7F1] p-3.5 text-sm">
                  <label className="flex min-h-[44px] items-center justify-between gap-3">
                    <span className="text-slate-700">
                      Require Owner Approval for New PCs
                    </span>
                    <input
                      type="checkbox"
                      checked={draft.require_device_approval}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [branch.id]: {
                            ...prev[branch.id],
                            require_device_approval: e.target.checked,
                          },
                        }))
                      }
                      className="h-5 w-5 rounded border-slate-300"
                    />
                  </label>

                  <label className="flex min-h-[44px] items-center justify-between gap-3">
                    <span className="text-slate-700">
                      Allow Mobile / Tablet Login
                    </span>
                    <input
                      type="checkbox"
                      checked={draft.allow_mobile_login}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [branch.id]: {
                            ...prev[branch.id],
                            allow_mobile_login: e.target.checked,
                          },
                        }))
                      }
                      className="h-5 w-5 rounded border-slate-300"
                    />
                  </label>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingId === branch.id}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#1B2A4A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#121D36] disabled:opacity-60 sm:w-auto"
                  >
                    <Save className="h-4 w-4 text-[#DFBE78]" />
                    {savingId === branch.id
                      ? "Saving..."
                      : `Save ${branch.display_name}`}
                  </button>
                </div>
              </div>
            </form>
          );
        })}
      </div>
    </div>
  );
}
