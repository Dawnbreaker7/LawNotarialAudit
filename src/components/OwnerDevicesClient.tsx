"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock,
  Download,
  Laptop,
  Pencil,
  Power,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Tablet,
  Trash2,
  X,
} from "lucide-react";
import type { PublicBranch } from "@/lib/auth/session";
import type {
  AuthorizedDevice,
  DeviceSession,
  DeviceType,
} from "@/types/database";

interface OwnerDevicesClientProps {
  initialBranches: PublicBranch[];
  initialDevices: AuthorizedDevice[];
  initialSessions: DeviceSession[];
  currentSessionId: string;
  currentDeviceId: string | null;
}

function getBranchLabel(branch: PublicBranch): string {
  if (branch.branch_code === "GENSAN") return "GenSan Branch";
  if (branch.branch_code === "MALUNGON") return "Malungon Branch";
  return branch.branch_name;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function DeviceTypeBadge({ type }: { type: DeviceType }) {
  const styles: Record<DeviceType, string> = {
    desktop: "bg-sky-50 text-sky-800 border-sky-200",
    mobile: "bg-rose-50 text-rose-800 border-rose-200",
    tablet: "bg-amber-50 text-amber-800 border-amber-200",
    unknown: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const Icon =
    type === "mobile"
      ? Smartphone
      : type === "tablet"
        ? Tablet
        : Laptop;

  const label = type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[type]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export default function OwnerDevicesClient({
  initialBranches,
  initialDevices,
  initialSessions,
  currentSessionId,
  currentDeviceId,
}: OwnerDevicesClientProps) {
  const [branches, setBranches] = useState<PublicBranch[]>(initialBranches);
  const [devices, setDevices] = useState<AuthorizedDevice[]>(initialDevices);
  const [sessions, setSessions] = useState<DeviceSession[]>(initialSessions);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [confirmDeleteDeviceId, setConfirmDeleteDeviceId] = useState<
    string | null
  >(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const branchById = new Map(branches.map((b) => [b.id, b]));
  const deviceById = new Map(devices.map((d) => [d.id, d]));

  async function refreshSnapshot() {
    setBusyKey("refresh");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/owner/devices", { cache: "no-store" });
      const data = (await res.json()) as {
        branches?: PublicBranch[];
        devices?: AuthorizedDevice[];
        activeSessions?: DeviceSession[];
        error?: string;
      };
      if (!res.ok) {
        setErrorMessage(data.error ?? "Failed to refresh.");
        return;
      }
      if (data.branches) setBranches(data.branches);
      if (data.devices) setDevices(data.devices);
      if (data.activeSessions) setSessions(data.activeSessions);
    } catch {
      setErrorMessage("Network error while refreshing data.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveDeviceLabel(deviceId: string) {
    const trimmed = labelDraft.trim();
    if (!trimmed) {
      setErrorMessage("Device label cannot be empty.");
      return;
    }

    setBusyKey(`label:${deviceId}`);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/owner/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, device_label: trimmed }),
      });
      const data = (await res.json()) as {
        device?: AuthorizedDevice;
        error?: string;
      };
      if (!res.ok || !data.device) {
        setErrorMessage(data.error ?? "Could not update device label.");
        return;
      }
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? data.device! : d))
      );
      setEditingDeviceId(null);
    } catch {
      setErrorMessage("Network error while saving device label.");
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleApproval(device: AuthorizedDevice) {
    setBusyKey(`approve:${device.id}`);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/owner/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: device.id,
          is_approved: !device.is_approved,
        }),
      });
      const data = (await res.json()) as {
        device?: AuthorizedDevice;
        error?: string;
      };
      if (!res.ok || !data.device) {
        setErrorMessage(data.error ?? "Could not update approval status.");
        return;
      }
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? data.device! : d))
      );
    } catch {
      setErrorMessage("Network error while updating approval status.");
    } finally {
      setBusyKey(null);
    }
  }

  async function forceLogout(sessionId: string) {
    setBusyKey(`logout:${sessionId}`);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/owner/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "force_logout", sessionId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMessage(data.error ?? "Could not force logout session.");
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      setErrorMessage("Network error while revoking session.");
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteDevice(deviceId: string) {
    setBusyKey(`delete:${deviceId}`);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/owner/devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMessage(data.error ?? "Could not delete device.");
        return;
      }
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      setSessions((prev) => prev.filter((s) => s.device_id !== deviceId));
      setConfirmDeleteDeviceId(null);
    } catch {
      setErrorMessage("Network error while deleting device.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#1B2A4A] sm:text-2xl">
            Device &amp; Active Session Control Center
          </h1>
          <p className="text-sm text-slate-600">
            Approve branch computers, label workstations, and remotely force-logout
            active sessions across GenSan Branch and Malungon Branch.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a
            href="/api/owner/backup"
            download
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#D8D0C0] bg-white px-3.5 py-2 text-sm font-semibold text-[#1B2A4A] transition hover:bg-[#FAF7F1] sm:w-auto"
          >
            <Download className="h-4 w-4 text-[#9A722C]" />
            Download Full System Backup (.json)
          </a>

          <button
            type="button"
            onClick={() => void refreshSnapshot()}
            disabled={busyKey === "refresh"}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#D8D0C0] bg-white px-3.5 py-2 text-sm font-medium text-[#1B2A4A] transition hover:bg-[#FAF7F1] disabled:opacity-60 sm:w-auto"
          >
            <RefreshCw
              className={`h-4 w-4 ${busyKey === "refresh" ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Section 1: Pending & Approved Devices Grouped by Account */}
      <section className="space-y-4">
        <h2 className="font-serif text-lg font-bold text-[#1B2A4A]">
          Authorized &amp; Pending Devices
        </h2>

        <div className="grid gap-5">
          {branches.map((branch) => {
            const branchDevices = devices.filter(
              (d) => d.branch_id === branch.id
            );
            const approvedCount = branchDevices.filter(
              (d) => d.is_approved
            ).length;
            const branchLabel = getBranchLabel(branch);

            return (
              <div
                key={branch.id}
                className="overflow-hidden rounded-xl border border-[#DFD7C8] bg-white shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE3D5] bg-[#FAF7F1] px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-[#1B2A4A]">
                      {branchLabel}
                    </h3>
                    <span className="rounded border border-[#DFD7C8] bg-white px-2 py-0.5 font-mono text-xs text-[#1B2A4A]">
                      {branch.branch_code}
                    </span>
                    {!branch.allow_mobile_login && (
                      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
                        Desktop Only
                      </span>
                    )}
                  </div>

                  <span className="font-mono text-sm font-medium tabular-nums text-slate-700">
                    {approvedCount} / {branch.max_devices} PCs approved
                  </span>
                </div>

                {branchDevices.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-500">
                    No devices have signed in for {branchLabel} yet.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {branchDevices.map((device) => {
                      const isEditing = editingDeviceId === device.id;
                      const isCurrentDevice = device.id === currentDeviceId;

                      return (
                        <div
                          key={device.id}
                          className="flex flex-col gap-4 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              {isEditing ? (
                                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                                  <input
                                    type="text"
                                    value={labelDraft}
                                    onChange={(e) =>
                                      setLabelDraft(e.target.value)
                                    }
                                    placeholder="e.g. GenSan PC 1 - Front Desk"
                                    className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] px-3 py-2 text-base text-slate-900 focus:border-[#1B2A4A] focus:outline-none sm:w-64 md:text-sm"
                                  />
                                  <div className="grid grid-cols-2 gap-2 sm:flex">
                                    <button
                                      type="button"
                                      disabled={
                                        busyKey === `label:${device.id}`
                                      }
                                      onClick={() =>
                                        void saveDeviceLabel(device.id)
                                      }
                                      className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-lg bg-[#1B2A4A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#121D36] disabled:opacity-60"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingDeviceId(null)}
                                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 text-xs font-medium text-[#1B2A4A] hover:bg-[#FAF7F1]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <span className="font-semibold text-[#1B2A4A]">
                                    {device.device_label ?? "Unnamed Device"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDeviceId(device.id);
                                      setLabelDraft(device.device_label ?? "");
                                    }}
                                    className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-[#D8D0C0] bg-white px-2.5 py-1 text-xs font-medium text-[#1B2A4A] hover:bg-[#FAF7F1] sm:min-h-[36px]"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    Edit Label
                                  </button>
                                  {isCurrentDevice && (
                                    <span className="rounded-full border border-[#B48A3E]/50 bg-[#FBF5E8] px-2.5 py-0.5 text-xs font-semibold text-[#7D5B1C]">
                                      This Device
                                    </span>
                                  )}
                                </>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                              <DeviceTypeBadge type={device.device_type} />
                              <span>
                                {device.os_name ?? "Unknown OS"} &bull;{" "}
                                {device.browser_name ?? "Unknown Browser"}
                              </span>
                              <span className="font-mono tabular-nums">
                                &bull; IP: {device.last_ip ?? "—"}
                              </span>
                              <span className="font-mono tabular-nums">
                                &bull; Registered:{" "}
                                {formatDateTime(device.created_at)}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2.5">
                            {device.is_approved ? (
                              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Approved
                              </span>
                            ) : (
                              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                                <Clock className="h-3.5 w-3.5" />
                                Pending Approval
                              </span>
                            )}

                            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
                              <button
                                type="button"
                                disabled={
                                  busyKey === `approve:${device.id}` ||
                                  (isCurrentDevice && device.is_approved)
                                }
                                onClick={() => void toggleApproval(device)}
                                className={`min-h-[44px] w-full rounded-lg px-3.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
                                  device.is_approved
                                    ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                                }`}
                              >
                                {device.is_approved
                                  ? "Revoke Device"
                                  : "Approve Device"}
                              </button>

                              {confirmDeleteDeviceId === device.id ? (
                                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-1.5">
                                  <button
                                    type="button"
                                    disabled={busyKey === `delete:${device.id}`}
                                    onClick={() => void deleteDevice(device.id)}
                                    className="min-h-[44px] rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                                  >
                                    {busyKey === `delete:${device.id}`
                                      ? "Deleting..."
                                      : "Confirm Delete"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyKey === `delete:${device.id}`}
                                    onClick={() =>
                                      setConfirmDeleteDeviceId(null)
                                    }
                                    className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={
                                    isCurrentDevice ||
                                    busyKey === `delete:${device.id}`
                                  }
                                  onClick={() =>
                                    setConfirmDeleteDeviceId(device.id)
                                  }
                                  title={
                                    isCurrentDevice
                                      ? "Cannot delete the device you are currently using"
                                      : "Delete device"
                                  }
                                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 2: Active Sessions */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-[#1B2A4A]">
            Active Sessions (<span className="font-mono tabular-nums">{sessions.length}</span>)
          </h2>
        </div>

        {/* Mobile Session Cards (< 768px Cover Screen) */}
        <div className="space-y-3 md:hidden">
          {sessions.length === 0 ? (
            <div className="rounded-xl border border-[#DFD7C8] bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-xs">
              No active sessions.
            </div>
          ) : (
            sessions.map((session) => {
              const branch = branchById.get(session.branch_id);
              const device = session.device_id
                ? deviceById.get(session.device_id)
                : undefined;
              const isCurrentSession = session.id === currentSessionId;

              return (
                <div
                  key={session.id}
                  className="rounded-xl border border-[#DFD7C8] bg-white p-4 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE3D5] pb-2.5">
                    <span className="font-semibold text-[#1B2A4A]">
                      {branch ? getBranchLabel(branch) : "Unknown Branch"}
                    </span>
                    <DeviceTypeBadge type={session.device_type} />
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#1B2A4A]">
                      <span>{device?.device_label ?? "Unlabeled Device"}</span>
                      {isCurrentSession && (
                        <span className="rounded-full border border-[#B48A3E]/50 bg-[#FBF5E8] px-2.5 py-0.5 text-xs font-semibold text-[#7D5B1C]">
                          Active Session
                        </span>
                      )}
                      {device && !device.is_approved && (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                          Pending
                        </span>
                      )}
                    </div>
                    <div>
                      {session.os_info ?? "Unknown"} &mdash;{" "}
                      {session.browser_info ?? "Unknown"}
                    </div>
                    <div className="font-mono tabular-nums">
                      IP: {session.ip_address ?? "—"}
                    </div>
                    <div className="font-mono tabular-nums">
                      Last Seen: {formatDateTime(session.last_seen_at)}
                    </div>
                  </div>

                  <div className="mt-3 border-t border-[#EAE3D5] pt-3">
                    <button
                      type="button"
                      disabled={
                        isCurrentSession || busyKey === `logout:${session.id}`
                      }
                      onClick={() => void forceLogout(session.id)}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Power className="h-4 w-4" />
                      Force Logout
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop / Unfolded Active Sessions Table (>= 768px) */}
        <div className="hidden overflow-x-auto rounded-xl border border-[#DFD7C8] bg-white shadow-xs md:block">
          <table className="min-w-full divide-y divide-[#EAE3D5] text-left text-sm">
            <thead className="bg-[#F4EFE4] text-xs font-semibold uppercase tracking-wider text-[#1B2A4A]">
              <tr>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Device Label</th>
                <th className="px-4 py-3">Device Type</th>
                <th className="px-4 py-3">OS &amp; Browser</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">Last Seen</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No active sessions.
                  </td>
                </tr>
              ) : (
                sessions.map((session) => {
                  const branch = branchById.get(session.branch_id);
                  const device = session.device_id
                    ? deviceById.get(session.device_id)
                    : undefined;
                  const isCurrentSession = session.id === currentSessionId;

                  return (
                    <tr key={session.id} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {branch ? getBranchLabel(branch) : "Unknown Branch"}
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        <div className="flex items-center gap-2">
                          <span>
                            {device?.device_label ?? "Unlabeled Device"}
                          </span>
                          {isCurrentSession && (
                            <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              Current
                            </span>
                          )}
                          {device && !device.is_approved && (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <DeviceTypeBadge type={session.device_type} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {session.os_info ?? "Unknown"} &mdash;{" "}
                        {session.browser_info ?? "Unknown"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                        {session.ip_address ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDateTime(session.last_seen_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={
                            isCurrentSession ||
                            busyKey === `logout:${session.id}`
                          }
                          onClick={() => void forceLogout(session.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Power className="h-3.5 w-3.5" />
                          Force Logout
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
