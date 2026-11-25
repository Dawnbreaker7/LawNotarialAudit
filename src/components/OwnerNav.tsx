"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BookOpen,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorSmartphone,
  ShieldCheck,
  X,
} from "lucide-react";

interface OwnerNavProps {
  deviceLabel: string;
  isDev?: boolean;
}

const NAV_ITEMS = [
  { href: "/owner/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/owner/audit", label: "Master Audit", icon: ClipboardList },
  { href: "/owner/books", label: "Books & Notary", icon: BookOpen },
  {
    href: "/owner/devices",
    label: "Devices & Sessions",
    icon: MonitorSmartphone,
  },
  { href: "/owner/branches", label: "Branch Settings", icon: Building2 },
] as const;

export default function OwnerNav({
  deviceLabel,
  isDev = false,
}: OwnerNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-[#B48A3E] bg-[#1B2A4A] text-white shadow-xs print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/owner/dashboard"
            className="flex min-h-[44px] min-w-0 items-center gap-2.5 font-semibold text-white"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#B48A3E]/60 bg-[#121D36] text-[#DFBE78]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate font-serif text-sm font-bold tracking-tight text-white">
                  Owner Audit Portal
                </span>
                {isDev && (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-amber-300 bg-[#FFFBEB] px-2 py-0.5 text-xs font-bold tracking-wide text-[#78350F]">
                    DEV SANDBOX
                  </span>
                )}
              </div>
              <div className="truncate text-xs font-medium text-slate-300">
                {deviceLabel}
              </div>
            </div>
          </Link>
        </div>

        {/* Unfolded / Desktop Navigation (>= 768px) */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition lg:px-3 lg:text-sm ${
                  active
                    ? "border border-[#B48A3E]/60 bg-[#121D36] text-[#F4DDA8]"
                    : "text-slate-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {isDev && (
            <Link
              href="/branch/register"
              className="hidden min-h-[44px] items-center gap-1.5 rounded-lg border border-amber-300/80 bg-[#FFFBEB] px-3 py-2 text-xs font-semibold text-[#78350F] transition hover:bg-amber-100 md:inline-flex"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Switch to Branch Register
            </Link>
          )}
          <form
            action="/api/auth/logout"
            method="POST"
            className="hidden md:block"
          >
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/15"
            >
              <LogOut className="h-4 w-4 text-[#DFBE78]" />
              Logout
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/20 p-2 text-slate-100 hover:bg-white/10 md:hidden"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

          {/* Quick Horizontal Scroll Tabs on Folded Cover Screen (< 768px) */}
      <div className="flex gap-1.5 overflow-x-auto border-t border-white/10 bg-[#15213B] px-3 py-2 md:hidden">
        {isDev && (
          <Link
            href="/branch/register"
            onClick={() => setMobileOpen(false)}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-[#FFFBEB] px-3 py-2 text-xs font-semibold text-[#78350F]"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">Branch Register</span>
          </Link>
        )}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                active
                  ? "border border-[#B48A3E]/60 bg-[#B48A3E]/20 text-[#F4DDA8]"
                  : "bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Collapsible Menu Drawer (< 768px) */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#15213B] px-4 py-3 md:hidden">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    active
                      ? "border border-[#B48A3E]/60 bg-[#B48A3E]/20 text-[#F4DDA8]"
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <form
            action="/api/auth/logout"
            method="POST"
            className="mt-3 border-t border-white/10 pt-3"
          >
            <button
              type="submit"
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm font-medium text-white hover:bg-white/15"
            >
              <LogOut className="h-4 w-4 text-[#DFBE78]" />
              Logout
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
