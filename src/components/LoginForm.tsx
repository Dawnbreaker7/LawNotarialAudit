"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, Lock, ShieldCheck } from "lucide-react";

interface LoginFormProps {
  reason?: string;
}

export default function LoginForm({ reason }: LoginFormProps) {
  const [branchCode, setBranchCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_code: branchCode.trim(),
          password,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok || !payload.redirectTo) {
        setError(payload.error ?? "Login failed. Please check your credentials.");
        setSubmitting(false);
        return;
      }

      window.location.assign(payload.redirectTo);
    } catch {
      setError("Network error while connecting to server. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#DFD7C8] bg-white shadow-xs">
      <div className="border-b-2 border-[#B48A3E] bg-[#1B2A4A] px-6 py-5 text-white sm:px-8">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#B48A3E]/50 bg-[#121D36] text-[#DFBE78]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold tracking-tight text-white">
              Notarial Register Portal
            </h1>
            <p className="mt-0.5 text-xs text-slate-200">
              GenSan Branch &bull; Malungon Branch &bull; Owner Audit
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8">

      {reason === "revoked" && !error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <span>
            Your session was ended or revoked by the administrator. Please sign
            in again.
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="branch_code"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1B2A4A]"
          >
            Username / Branch Code
          </label>
          <input
            id="branch_code"
            name="branch_code"
            type="text"
            required
            autoComplete="username"
            placeholder="e.g. GENSAN, MALUNGON, or Owner Username"
            value={branchCode}
            onChange={(e) => setBranchCode(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-[#FAF7F1]/50 px-3.5 py-2.5 font-mono text-base tracking-wide text-slate-900 placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500 focus:border-[#1B2A4A] focus:bg-white focus:outline-none md:text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1B2A4A]"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-[#FAF7F1]/50 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-500 focus:border-[#1B2A4A] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#B48A3E] md:text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#1B2A4A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#121D36] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Lock className="h-4 w-4 text-[#DFBE78]" />
          {submitting ? "Verifying device & credentials..." : "Sign In"}
        </button>
      </form>
      </div>
    </div>
  );
}
