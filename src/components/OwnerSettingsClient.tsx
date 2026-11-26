"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import OwnerBranchesClient from "@/components/OwnerBranchesClient";
import type { OwnerBranchConfig } from "@/lib/owner/branches";
import type { OwnerStaffMember, StaffBranchOption } from "@/lib/owner/staff";

interface OwnerSettingsClientProps {
  initialStaff: OwnerStaffMember[];
  staffBranches: StaffBranchOption[];
  initialBranches: OwnerBranchConfig[];
  initialPermissionError?: boolean;
}

type SettingsTab = "staff" | "security";
type BranchFilterTab = "ALL" | "GENSAN" | "MALUNGON";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return DATE_FORMATTER.format(parsed);
}

export default function OwnerSettingsClient({
  initialStaff,
  staffBranches,
  initialBranches,
  initialPermissionError = false,
}: OwnerSettingsClientProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("staff");
  const [staff, setStaff] = useState<OwnerStaffMember[]>(initialStaff);
  const [branchFilter, setBranchFilter] = useState<BranchFilterTab>("ALL");

  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Add Branch Account Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addBranchId, setAddBranchId] = useState<string>(
    staffBranches[0]?.id ?? ""
  );
  const [addFullName, setAddFullName] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addConfirmPassword, setAddConfirmPassword] = useState("");
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showAddConfirm, setShowAddConfirm] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Reset Password Modal
  const [resetTarget, setResetTarget] = useState<OwnerStaffMember | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSaving, setResetSaving] = useState(false);

  // Confirmation Dialogs for Revoke / Delete
  const [revokeTarget, setRevokeTarget] = useState<OwnerStaffMember | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<OwnerStaffMember | null>(
    null
  );
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  useEffect(() => {
    const anyModalOpen =
      showAddModal ||
      Boolean(resetTarget) ||
      Boolean(revokeTarget) ||
      Boolean(deleteTarget);
    if (!anyModalOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (creating || resetSaving || actionBusyId) return;
        setShowAddModal(false);
        setResetTarget(null);
        setRevokeTarget(null);
        setDeleteTarget(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    showAddModal,
    resetTarget,
    revokeTarget,
    deleteTarget,
    creating,
    resetSaving,
    actionBusyId,
  ]);

  const counts = useMemo(() => {
    let totalActive = 0;
    let totalRevoked = 0;
    let gensanCount = 0;
    let malungonCount = 0;
    for (const member of staff) {
      if (member.is_active) totalActive += 1;
      else totalRevoked += 1;
      if (member.branch_code === "GENSAN") gensanCount += 1;
      else if (member.branch_code === "MALUNGON") malungonCount += 1;
    }
    return {
      total: staff.length,
      totalActive,
      totalRevoked,
      gensanCount,
      malungonCount,
    };
  }, [staff]);

  const visibleStaff = useMemo(() => {
    const filtered =
      branchFilter === "ALL"
        ? staff
        : staff.filter((member) => member.branch_code === branchFilter);
    return [...filtered].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [staff, branchFilter]);

  function openAddModal() {
    const preferredBranch =
      branchFilter === "GENSAN" || branchFilter === "MALUNGON"
        ? (staffBranches.find((b) => b.branch_code === branchFilter)?.id ??
          staffBranches[0]?.id ??
          "")
        : (staffBranches[0]?.id ?? "");

    setAddBranchId(preferredBranch);
    setAddFullName("");
    setAddUsername("");
    setAddPassword("");
    setAddConfirmPassword("");
    setShowAddPassword(false);
    setShowAddConfirm(false);
    setAddError(null);
    setShowAddModal(true);
  }

  const trimmedAddUsername = addUsername.trim();
  const addUsernameHasSpaces = /\s/.test(trimmedAddUsername);
  const addPasswordMismatch =
    addConfirmPassword.length > 0 && addPassword !== addConfirmPassword;
  const resetPasswordMismatch =
    resetConfirmPassword.length > 0 &&
    resetNewPassword !== resetConfirmPassword;

  async function handleCreateStaff(e: FormEvent) {
    e.preventDefault();
    setAddError(null);
    setBannerError(null);
    setBannerSuccess(null);

    if (!addBranchId) {
      setAddError("Please select an assigned branch.");
      return;
    }
    if (!addFullName.trim()) {
      setAddError("Please enter the staff member's full name or label.");
      return;
    }
    if (
      trimmedAddUsername.length < 3 ||
      trimmedAddUsername.length > 40 ||
      addUsernameHasSpaces
    ) {
      setAddError(
        "Username must be 3 to 40 characters long and contain no spaces."
      );
      return;
    }
    if (addPassword.length < 6) {
      setAddError("Password must be at least 6 characters.");
      return;
    }
    if (addPassword !== addConfirmPassword) {
      setAddError("Passwords do not match.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/owner/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: addBranchId,
          full_name: addFullName.trim(),
          username: trimmedAddUsername,
          password: addPassword,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        staff?: OwnerStaffMember;
        error?: string;
      };

      if (!res.ok || !payload.staff) {
        setAddError(payload.error ?? "Failed to create branch staff account.");
        return;
      }

      setStaff((prev) => [payload.staff!, ...prev]);
      setShowAddModal(false);
      setBannerSuccess(
        `Created account "${payload.staff.username}" (${payload.staff.full_name}) under ${payload.staff.branch_name}.`
      );
    } catch {
      setAddError("Network error while creating branch staff account.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeStaff() {
    if (!revokeTarget) return;
    setActionBusyId(revokeTarget.id);
    setBannerError(null);
    setBannerSuccess(null);

    try {
      const res = await fetch(`/api/owner/staff/${revokeTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        staff?: OwnerStaffMember;
        error?: string;
      };

      if (!res.ok || !payload.staff) {
        setBannerError(payload.error ?? "Failed to remove staff access.");
        setRevokeTarget(null);
        return;
      }

      setStaff((prev) =>
        prev.map((item) =>
          item.id === revokeTarget.id ? payload.staff! : item
        )
      );
      setBannerSuccess(
        `Access removed for ${payload.staff.full_name} (${payload.staff.username}). Active sessions were signed out immediately.`
      );
      setRevokeTarget(null);
    } catch {
      setBannerError("Network error while removing staff access.");
      setRevokeTarget(null);
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleRestoreStaff(member: OwnerStaffMember) {
    setActionBusyId(member.id);
    setBannerError(null);
    setBannerSuccess(null);

    try {
      const res = await fetch(`/api/owner/staff/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        staff?: OwnerStaffMember;
        error?: string;
      };

      if (!res.ok || !payload.staff) {
        setBannerError(payload.error ?? "Failed to restore staff access.");
        return;
      }

      setStaff((prev) =>
        prev.map((item) => (item.id === member.id ? payload.staff! : item))
      );
      setBannerSuccess(
        `Access restored for ${payload.staff.full_name} (${payload.staff.username}).`
      );
    } catch {
      setBannerError("Network error while restoring staff access.");
    } finally {
      setActionBusyId(null);
    }
  }

  function openResetModal(member: OwnerStaffMember) {
    setResetTarget(member);
    setResetNewPassword("");
    setResetConfirmPassword("");
    setShowResetPassword(false);
    setShowResetConfirm(false);
    setResetError(null);
  }

  async function handleSubmitResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;

    setResetError(null);
    setBannerError(null);
    setBannerSuccess(null);

    if (resetNewPassword.length < 6) {
      setResetError("New password must be at least 6 characters.");
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    setResetSaving(true);
    try {
      const res = await fetch(`/api/owner/staff/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          newPassword: resetNewPassword,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        staff?: OwnerStaffMember;
        error?: string;
      };

      if (!res.ok || !payload.staff) {
        setResetError(payload.error ?? "Failed to reset password.");
        return;
      }

      setResetTarget(null);
      setBannerSuccess(
        `Password reset for ${payload.staff.full_name} (${payload.staff.username}). Active sessions were cleared.`
      );
    } catch {
      setResetError("Network error while resetting password.");
    } finally {
      setResetSaving(false);
    }
  }

  async function handleDeleteStaff() {
    if (!deleteTarget) return;
    setActionBusyId(deleteTarget.id);
    setBannerError(null);
    setBannerSuccess(null);

    try {
      const res = await fetch(`/api/owner/staff/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const payload = (await res.json().catch(() => ({}))) as {
        deletedId?: string;
        error?: string;
      };

      if (!res.ok) {
        setBannerError(payload.error ?? "Failed to delete staff account.");
        setDeleteTarget(null);
        return;
      }

      setStaff((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setBannerSuccess(
        `Permanently deleted account "${deleteTarget.username}" (${deleteTarget.full_name}). Historical entries remain intact.`
      );
      setDeleteTarget(null);
    } catch {
      setBannerError("Network error while deleting staff account.");
      setDeleteTarget(null);
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Settings Mode Switcher */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#DFD7C8] bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#DFD7C8] bg-[#FAF7F1] text-[#1B2A4A]">
            <Users className="h-5 w-5 text-[#B48A3E]" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold text-[#1B2A4A] sm:text-2xl">
              Branch Settings &amp; Staff Access
            </h1>
            <p className="text-xs text-[#64748B] sm:text-sm">
              Manage per-employee credentials, instant access revocation, and
              branch security policies.
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Branch Settings Sections"
          className="inline-flex min-h-[44px] rounded-lg border border-[#DFD7C8] bg-[#FAF7F1] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "staff"}
            onClick={() => setActiveTab("staff")}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
              activeTab === "staff"
                ? "bg-[#1B2A4A] text-white shadow-2xs"
                : "text-[#1B2A4A] hover:bg-white"
            }`}
          >
            <Users className="h-4 w-4 text-[#B48A3E]" />
            Staff Accounts ({counts.totalActive})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "security"}
            onClick={() => setActiveTab("security")}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
              activeTab === "security"
                ? "bg-[#1B2A4A] text-white shadow-2xs"
                : "text-[#1B2A4A] hover:bg-white"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4 text-[#B48A3E]" />
            Branch Security &amp; Backup
          </button>
        </div>
      </div>

      {activeTab === "security" ? (
        <OwnerBranchesClient initialBranches={initialBranches} />
      ) : (
        <section className="space-y-5">
          {initialPermissionError && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 bg-[#FFFBEB] p-4 text-sm text-[#78350F]"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-semibold">
                    Database Grant Required for <code>branch_users</code>
                  </p>
                  <p className="mt-1 text-xs">
                    Run{" "}
                    <code className="rounded bg-amber-100 px-1.5 py-0.5">
                      scripts/grant_branch_users_permissions.sql
                    </code>{" "}
                    in the Supabase SQL Editor so the server role can manage
                    branch staff accounts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {bannerError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 rounded-lg border border-red-300 bg-[#FEF2F2] px-4 py-3 text-sm text-[#7F1D1D]"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
                <span>{bannerError}</span>
              </div>
              <button
                type="button"
                onClick={() => setBannerError(null)}
                aria-label="Dismiss error"
                className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-[#7F1D1D] hover:bg-red-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {bannerSuccess && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-[#ECFDF5] px-4 py-3 text-sm text-[#065F46]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{bannerSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setBannerSuccess(null)}
                aria-label="Dismiss notice"
                className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-[#065F46] hover:bg-emerald-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Toolbar: Branch Filter Pills + Add Account CTA */}
          <div className="flex flex-col gap-3 rounded-xl border border-[#DFD7C8] bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  {
                    value: "ALL",
                    label: `All Branches (${counts.total})`,
                  },
                  {
                    value: "GENSAN",
                    label: `GenSan Branch (${counts.gensanCount})`,
                  },
                  {
                    value: "MALUNGON",
                    label: `Malungon Branch (${counts.malungonCount})`,
                  },
                ] as const
              ).map((tab) => {
                const active = branchFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setBranchFilter(tab.value)}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
                      active
                        ? "border-[#1B2A4A] bg-[#1B2A4A] text-white shadow-2xs"
                        : "border-[#DFD7C8] bg-[#FAF7F1] text-[#1B2A4A] hover:bg-[#F4EFE4]"
                    }`}
                  >
                    <Building2
                      className={`h-4 w-4 ${
                        active ? "text-[#B48A3E]" : "text-[#64748B]"
                      }`}
                    />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={openAddModal}
              disabled={staffBranches.length === 0 || initialPermissionError}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#1B2A4A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#121D36] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <UserPlus className="h-4 w-4 text-[#B48A3E]" />
              + Add Branch Account
            </button>
          </div>

          {/* Mobile Stacked Cards (< 768px Cover Screen) */}
          <div className="space-y-3 md:hidden">
            {visibleStaff.length === 0 ? (
              <div className="rounded-xl border border-[#DFD7C8] bg-white px-4 py-10 text-center text-sm text-[#64748B] shadow-xs">
                No individual staff accounts created yet for this view. Click{" "}
                <strong>+ Add Branch Account</strong> to issue employee logins.
              </div>
            ) : (
              visibleStaff.map((member) => {
                const isBusy = actionBusyId === member.id;
                return (
                  <div
                    key={member.id}
                    className="rounded-xl border border-[#DFD7C8] bg-white p-4 shadow-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#EAE3D5] pb-3">
                      <div className="min-w-0 space-y-1">
                        <div className="font-serif text-base font-bold text-[#1B2A4A]">
                          {member.full_name}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-[#DFD7C8] bg-[#FAF7F1] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#1B2A4A]">
                            @{member.username}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${
                              member.branch_code === "GENSAN"
                                ? "bg-[#1B2A4A]"
                                : "bg-[#065F46]"
                            }`}
                          >
                            {member.branch_name}
                          </span>
                        </div>
                      </div>

                      {member.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-[#ECFDF5] px-2.5 py-0.5 text-xs font-semibold text-[#065F46]">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-[#FEF2F2] px-2.5 py-0.5 text-xs font-semibold text-[#7F1D1D]">
                          <UserX className="h-3.5 w-3.5" />
                          Access Removed
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-[#64748B]">
                      <span>Created: {formatDate(member.created_at)}</span>
                      {!member.is_active && member.revoked_at && (
                        <span className="text-[#7F1D1D]">
                          Revoked: {formatDate(member.revoked_at)}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {member.is_active ? (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openResetModal(member)}
                            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 text-xs font-semibold text-[#1B2A4A] transition hover:bg-[#FAF7F1] disabled:opacity-50"
                          >
                            <KeyRound className="h-3.5 w-3.5 text-[#B48A3E]" />
                            Reset Password
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setRevokeTarget(member)}
                            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-[#7F1D1D] transition hover:bg-[#FEF2F2] disabled:opacity-50"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            Remove Access
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleRestoreStaff(member)}
                            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-[#ECFDF5] px-3 py-2 text-xs font-semibold text-[#065F46] transition hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restore Access
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setDeleteTarget(member)}
                            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-[#7F1D1D] transition hover:bg-[#FEF2F2] disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Permanently
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table (>= 768px) */}
          <div className="hidden overflow-x-auto rounded-xl border border-[#DFD7C8] bg-white shadow-xs md:block">
            <table className="min-w-full divide-y divide-[#EAE3D5] text-left text-sm">
              <thead className="bg-[#F4EFE4] text-xs font-semibold uppercase tracking-wider text-[#1B2A4A]">
                <tr>
                  <th className="px-4 py-3">Staff Name / Label</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Assigned Branch</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created / Revoked</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleStaff.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-[#64748B]"
                    >
                      No individual staff accounts created yet for this view.
                      Click <strong>+ Add Branch Account</strong> to issue
                      employee logins.
                    </td>
                  </tr>
                ) : (
                  visibleStaff.map((member) => {
                    const isBusy = actionBusyId === member.id;
                    return (
                      <tr key={member.id} className="hover:bg-stone-50/70">
                        <td className="px-4 py-3.5 font-semibold text-[#1B2A4A]">
                          {member.full_name}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex rounded-full border border-[#DFD7C8] bg-[#FAF7F1] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#1B2A4A]">
                            {member.username}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${
                              member.branch_code === "GENSAN"
                                ? "bg-[#1B2A4A]"
                                : "bg-[#065F46]"
                            }`}
                          >
                            {member.branch_name}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {member.is_active ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-[#ECFDF5] px-2.5 py-0.5 text-xs font-semibold text-[#065F46]">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-[#FEF2F2] px-2.5 py-0.5 text-xs font-semibold text-[#7F1D1D]">
                              <UserX className="h-3.5 w-3.5" />
                              Access Removed
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs tabular-nums text-[#64748B]">
                          <div>Created: {formatDate(member.created_at)}</div>
                          {!member.is_active && member.revoked_at && (
                            <div className="text-[#7F1D1D]">
                              Revoked: {formatDate(member.revoked_at)}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            {member.is_active ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => openResetModal(member)}
                                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#DFD7C8] bg-white px-3 py-1.5 text-xs font-semibold text-[#1B2A4A] transition hover:bg-[#FAF7F1] disabled:opacity-50"
                                >
                                  <KeyRound className="h-3.5 w-3.5 text-[#B48A3E]" />
                                  Reset Password
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => setRevokeTarget(member)}
                                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#7F1D1D] transition hover:bg-[#FEF2F2] disabled:opacity-50"
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                  Remove Access
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleRestoreStaff(member)}
                                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-emerald-300 bg-[#ECFDF5] px-3 py-1.5 text-xs font-semibold text-[#065F46] transition hover:bg-emerald-100 disabled:opacity-50"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Restore Access
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => setDeleteTarget(member)}
                                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#7F1D1D] transition hover:bg-[#FEF2F2] disabled:opacity-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete Permanently
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal: + Add Branch Account */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-staff-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !creating) {
              setShowAddModal(false);
            }
          }}
        >
          <form
            onSubmit={(e) => void handleCreateStaff(e)}
            className="flex max-h-[88vh] w-[94vw] flex-col overflow-hidden rounded-xl border border-[#DFD7C8] bg-white shadow-xl sm:max-w-lg"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#EAE3D5] bg-[#FAF7F1] px-5 py-4">
              <div>
                <h2
                  id="add-staff-modal-title"
                  className="font-serif text-lg font-bold text-[#1B2A4A]"
                >
                  Add Branch Staff Account
                </h2>
                <p className="text-xs text-[#64748B]">
                  Issue a personal login bound to a single branch office.
                </p>
              </div>
              <button
                type="button"
                disabled={creating}
                onClick={() => setShowAddModal(false)}
                aria-label="Close modal"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#64748B] hover:bg-white hover:text-[#1B2A4A]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {addError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-300 bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#7F1D1D]"
                >
                  {addError}
                </div>
              )}

              <div>
                <label
                  htmlFor="add-staff-branch"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]"
                >
                  Assigned Branch
                </label>
                <select
                  id="add-staff-branch"
                  value={addBranchId}
                  onChange={(e) => setAddBranchId(e.target.value)}
                  required
                  className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 text-base text-[#1C2434] focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                >
                  {staffBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branch_name} ({b.branch_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="add-staff-name"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]"
                >
                  Staff Name / Label
                </label>
                <input
                  id="add-staff-name"
                  type="text"
                  required
                  maxLength={100}
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz — Front Desk"
                  className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 text-base text-[#1C2434] placeholder:text-[#64748B] focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="add-staff-username"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]"
                >
                  Username
                </label>
                <input
                  id="add-staff-username"
                  type="text"
                  required
                  autoComplete="off"
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  placeholder="e.g. juan.gensan"
                  className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 font-mono text-base text-[#1C2434] placeholder:text-[#64748B] focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                />
                {addUsernameHasSpaces ? (
                  <p className="mt-1 text-xs font-medium text-[#7F1D1D]">
                    Username cannot contain spaces.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[#64748B]">
                    Exact case, 3–40 characters, no spaces.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="add-staff-password"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="add-staff-password"
                    type={showAddPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white py-2 pl-3 pr-11 text-base text-[#1C2434] placeholder:text-[#64748B] focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword((prev) => !prev)}
                    aria-label={
                      showAddPassword ? "Hide password" : "Show password"
                    }
                    className="absolute inset-y-0 right-0 flex min-w-[44px] items-center justify-center text-[#64748B] hover:text-[#1B2A4A]"
                  >
                    {showAddPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="add-staff-confirm"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="add-staff-confirm"
                    type={showAddConfirm ? "text" : "password"}
                    required
                    minLength={6}
                    value={addConfirmPassword}
                    onChange={(e) => setAddConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white py-2 pl-3 pr-11 text-base text-[#1C2434] placeholder:text-[#64748B] focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddConfirm((prev) => !prev)}
                    aria-label={
                      showAddConfirm
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                    className="absolute inset-y-0 right-0 flex min-w-[44px] items-center justify-center text-[#64748B] hover:text-[#1B2A4A]"
                  >
                    {showAddConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {addPasswordMismatch && (
                  <p className="mt-1 text-xs font-medium text-[#7F1D1D]">
                    Passwords do not match.
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[#EAE3D5] bg-[#FAF7F1] px-5 py-3.5">
              <button
                type="button"
                disabled={creating}
                onClick={() => setShowAddModal(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#DFD7C8] bg-white px-4 py-2 text-sm font-semibold text-[#1B2A4A] hover:bg-[#F4EFE4]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  creating || addPasswordMismatch || addUsernameHasSpaces
                }
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#1B2A4A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#121D36] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4 text-[#B48A3E]" />
                {creating ? "Creating..." : "Create Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Reset Password */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-staff-password-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !resetSaving) {
              setResetTarget(null);
            }
          }}
        >
          <form
            onSubmit={(e) => void handleSubmitResetPassword(e)}
            className="flex max-h-[88vh] w-[94vw] flex-col overflow-hidden rounded-xl border border-[#DFD7C8] bg-white shadow-xl sm:max-w-lg"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#EAE3D5] bg-[#FAF7F1] px-5 py-4">
              <div>
                <h2
                  id="reset-staff-password-title"
                  className="font-serif text-lg font-bold text-[#1B2A4A]"
                >
                  Reset Staff Password
                </h2>
                <p className="text-xs text-[#64748B]">
                  {resetTarget.full_name} (@{resetTarget.username})
                </p>
              </div>
              <button
                type="button"
                disabled={resetSaving}
                onClick={() => setResetTarget(null)}
                aria-label="Close modal"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#64748B] hover:bg-white hover:text-[#1B2A4A]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {resetError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-300 bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#7F1D1D]"
                >
                  {resetError}
                </div>
              )}

              <p className="rounded-lg border border-amber-200 bg-[#FFFBEB] px-3.5 py-2.5 text-xs text-[#78350F]">
                Resetting the password will immediately sign this staff member
                out of active sessions so they must log in with the new
                password.
              </p>

              <div>
                <label
                  htmlFor="reset-staff-password"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="reset-staff-password"
                    type={showResetPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white py-2 pl-3 pr-11 text-base text-[#1C2434] placeholder:text-[#64748B] focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((prev) => !prev)}
                    aria-label={
                      showResetPassword ? "Hide password" : "Show password"
                    }
                    className="absolute inset-y-0 right-0 flex min-w-[44px] items-center justify-center text-[#64748B] hover:text-[#1B2A4A]"
                  >
                    {showResetPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="reset-staff-confirm"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="reset-staff-confirm"
                    type={showResetConfirm ? "text" : "password"}
                    required
                    minLength={6}
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white py-2 pl-3 pr-11 text-base text-[#1C2434] placeholder:text-[#64748B] focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm((prev) => !prev)}
                    aria-label={
                      showResetConfirm
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                    className="absolute inset-y-0 right-0 flex min-w-[44px] items-center justify-center text-[#64748B] hover:text-[#1B2A4A]"
                  >
                    {showResetConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {resetPasswordMismatch && (
                  <p className="mt-1 text-xs font-medium text-[#7F1D1D]">
                    Passwords do not match.
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[#EAE3D5] bg-[#FAF7F1] px-5 py-3.5">
              <button
                type="button"
                disabled={resetSaving}
                onClick={() => setResetTarget(null)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#DFD7C8] bg-white px-4 py-2 text-sm font-semibold text-[#1B2A4A] hover:bg-[#F4EFE4]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resetSaving || resetPasswordMismatch}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#1B2A4A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#121D36] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4 text-[#B48A3E]" />
                {resetSaving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Modal: Remove Access */}
      {revokeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-staff-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionBusyId) {
              setRevokeTarget(null);
            }
          }}
        >
          <div className="flex max-h-[88vh] w-[94vw] flex-col overflow-hidden rounded-xl border border-red-200 bg-white shadow-xl sm:max-w-lg">
            <div className="flex items-center justify-between border-b border-red-100 bg-[#FEF2F2] px-5 py-4">
              <div className="flex items-center gap-2 text-[#7F1D1D]">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <h2
                  id="revoke-staff-title"
                  className="font-serif text-lg font-bold"
                >
                  Remove Staff Access?
                </h2>
              </div>
              <button
                type="button"
                disabled={Boolean(actionBusyId)}
                onClick={() => setRevokeTarget(null)}
                aria-label="Close modal"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#7F1D1D] hover:bg-red-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto p-5 text-sm text-[#1C2434]">
              <p>
                You are about to deactivate{" "}
                <strong>{revokeTarget.full_name}</strong> (
                <code className="rounded bg-[#FAF7F1] px-1.5 py-0.5 font-mono text-xs">
                  {revokeTarget.username}
                </code>
                ) under <strong>{revokeTarget.branch_name}</strong>.
              </p>
              <div className="rounded-lg border border-red-200 bg-[#FEF2F2] p-3 text-xs text-[#7F1D1D]">
                This employee will be <strong>signed out immediately</strong>{" "}
                from any active session and blocked from logging in until you
                restore their access. All historical entries they encoded remain
                safely preserved.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-[#EAE3D5] bg-[#FAF7F1] px-5 py-3.5">
              <button
                type="button"
                disabled={Boolean(actionBusyId)}
                onClick={() => setRevokeTarget(null)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#DFD7C8] bg-white px-4 py-2 text-sm font-semibold text-[#1B2A4A] hover:bg-[#F4EFE4]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(actionBusyId)}
                onClick={() => void handleRevokeStaff()}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[#991B1B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7F1D1D] disabled:opacity-50"
              >
                <UserX className="h-4 w-4" />
                {actionBusyId ? "Removing..." : "Confirm Remove Access"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Permanently */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-staff-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionBusyId) {
              setDeleteTarget(null);
            }
          }}
        >
          <div className="flex max-h-[88vh] w-[94vw] flex-col overflow-hidden rounded-xl border border-red-200 bg-white shadow-xl sm:max-w-lg">
            <div className="flex items-center justify-between border-b border-red-100 bg-[#FEF2F2] px-5 py-4">
              <div className="flex items-center gap-2 text-[#7F1D1D]">
                <Trash2 className="h-5 w-5 shrink-0" />
                <h2
                  id="delete-staff-title"
                  className="font-serif text-lg font-bold"
                >
                  Delete Account Permanently?
                </h2>
              </div>
              <button
                type="button"
                disabled={Boolean(actionBusyId)}
                onClick={() => setDeleteTarget(null)}
                aria-label="Close modal"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#7F1D1D] hover:bg-red-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto p-5 text-sm text-[#1C2434]">
              <p>
                Permanently delete the account for{" "}
                <strong>{deleteTarget.full_name}</strong> (
                <code className="rounded bg-[#FAF7F1] px-1.5 py-0.5 font-mono text-xs">
                  {deleteTarget.username}
                </code>
                )?
              </p>
              <div className="rounded-lg border border-emerald-200 bg-[#ECFDF5] p-3 text-xs text-[#065F46]">
                All historical notarial register entries encoded by{" "}
                <strong>{deleteTarget.full_name}</strong> remain safely
                preserved with their recorded name in the Master Audit.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-[#EAE3D5] bg-[#FAF7F1] px-5 py-3.5">
              <button
                type="button"
                disabled={Boolean(actionBusyId)}
                onClick={() => setDeleteTarget(null)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#DFD7C8] bg-white px-4 py-2 text-sm font-semibold text-[#1B2A4A] hover:bg-[#F4EFE4]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(actionBusyId)}
                onClick={() => void handleDeleteStaff()}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[#991B1B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7F1D1D] disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {actionBusyId ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
