# Project Plan: Notarial Register & Branch Audit System

## Tech Stack
- **Framework:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database & Realtime:** Supabase (PostgreSQL + Realtime)
- **Auth & Security:** Custom Branch Code + Password auth (`bcryptjs`) with DB-backed HttpOnly session cookies, `ua-parser-js` for device detection
- **Export:** SheetJS (`xlsx`) / Print-ready CSS matching the physical Notarial Register layout

---

## Business Rules
- **Two Branches Only:** There are exactly two branches: **GenSan Branch** (`GENSAN`) and **Malungon Branch** (`MALUNGON`) (plus the `OWNER` admin account).
- **Mandatory Branch Attribution:** Every register page, entry view, print layout, and owner audit table must clearly display which branch it belongs to (`GenSan Branch` or `Malungon Branch`).
- **Dual Fee Tracking (PHP):** `notarial_entries` includes both `fee_amount` (official register fee) and `amount_paid` (actual transaction amount paid in PHP).

---

## Phase 1: Database Schema & Seed Data
**Goal:** Establish PostgreSQL tables for branches, register books, entries, audit logs, and device sessions.

- [x] Create `branches` table:
  - `id` (uuid, PK), `branch_code` (text, unique), `branch_name` (text), `password_hash` (text), `role` ('owner' | 'branch'), `allow_mobile_login` (boolean, default false), `require_device_approval` (boolean, default true), `max_devices` (int), `created_at`
- [x] Create `notarial_books` table:
  - `id` (uuid, PK), `branch_id` (FK -> branches), `notary_name`, `jurisdiction`, `appointment_date`, `commission_expiry`, `book_no`, `series_year`, `is_active`
- [x] Create `notarial_entries` table:
  - `id` (uuid, PK), `book_id` (FK -> notarial_books), `branch_id` (FK -> branches), `page_no` (int), `entry_number` (int), `instrument_title` (text), `parties` (text), `witnesses` (text), `competent_evidence_id` (text), `notarized_at` (timestamptz), `notarial_act_type` (text), `fee_amount` (numeric, official register fee), `amount_paid` (numeric, actual transaction amount paid in PHP), `or_number` (text), `place_and_remarks` (text), `created_by_session_id` (uuid), `created_at`, `updated_at`
- [x] Create `authorized_devices` table:
  - `id` (uuid, PK), `branch_id` (FK -> branches), `device_token_hash` (text, unique), `device_label` (text, e.g. "Front Desk PC"), `device_type` ('desktop' | 'mobile' | 'tablet'), `os_name`, `browser_name`, `is_approved` (boolean, default false), `last_ip`, `created_at`
- [x] Create `device_sessions` table:
  - `id` (uuid, PK), `branch_id` (FK -> branches), `device_id` (FK -> authorized_devices), `session_token_hash` (text, unique), `device_type`, `os_info`, `browser_info`, `ip_address`, `is_active` (boolean, default true), `revoked_at` (timestamptz), `revoked_by` (text), `last_seen_at`, `created_at`
- [x] Create `audit_logs` table:
  - `id` (uuid, PK), `branch_id`, `session_id`, `action` ('CREATE_ENTRY' | 'EDIT_ENTRY' | 'DELETE_ENTRY' | 'LOGIN_SUCCESS' | 'LOGIN_BLOCKED_MOBILE' | 'DEVICE_REVOKED'), `target_id`, `old_data` (jsonb), `new_data` (jsonb), `created_at`
- [x] Seed `OWNER` (`Owner Admin`), `GENSAN` (`GenSan Branch`, Book 63, Series of 2026), and `MALUNGON` (`Malungon Branch`, Book 1, Series of 2026) under Notary `Atty. Venchito M. Bangayan`.

**Verification:** Tables exist in Supabase, foreign keys resolve cleanly, and seed script runs without errors.

---

## Phase 2: Branch Login & 3-Layer Device Guard
**Goal:** Build the Branch Code + Password login flow with device detection, mobile blocking, PC approval, and instant remote logout.

- [x] Build `/login` page with minimal UI: **Branch Code** input + **Password** input only.
- [x] Create `POST /api/auth/login`:
  - Verify `branch_code` and `password_hash`.
  - Parse `User-Agent` using `ua-parser-js` to detect `device_type`, `os_name`, and `browser_name`.
  - If `role === 'branch'` and `device_type !== 'desktop'` and `!allow_mobile_login`: log `LOGIN_BLOCKED_MOBILE` to `audit_logs` and return `403 Forbidden ("Desktop computer required for branch access")`.
  - Check `device_token` cookie against `authorized_devices`. If unrecognized, register it with `is_approved = false` (pending owner approval) or allow login in restricted mode if owner prefers monitor-and-kick.
  - Create row in `device_sessions` and set `HttpOnly`, `SameSite=Lax`, `Secure` session cookie.
- [x] Create Next.js `middleware.ts` + server session helper (`getValidSession()`):
  - Validate session cookie against `device_sessions` where `is_active = true` and `revoked_at IS NULL`.
  - Update `last_seen_at` timestamp.
- [x] Implement client-side `<SessionWatcher />` using Supabase Realtime listening to `device_sessions`:
  - If current session's `is_active` flips to `false`, immediately clear state and redirect to `/login?reason=revoked`.

**Verification:** Logging in from Chrome DevTools Mobile Emulation is detected as `Mobile` and blocked/flagged. Revoking a session in DB kicks the active browser tab out immediately.

---

## Phase 3: Branch Portal (Notarial Register Encoding)
**Goal:** Fast, keyboard-friendly data entry matching the physical register layout.

- [x] Build `/branch/register` page:
  - Header bar clearly displaying the active **Branch (`GenSan Branch` or `Malungon Branch`), Book No., Page No., Series Year, and Notary Name**.
  - Quick-entry form / inline table for all 9 register columns plus actual `amount_paid` (PHP) alongside `fee_amount` (official register fee).
  - Every entry row/view clearly displays which branch (`GenSan Branch` or `Malungon Branch`) it belongs to.
  - Auto-increment `entry_number` per book and auto-calculate `page_no` (e.g., 5 entries per physical page, overridable).
  - Search and filter by Entry No., Party Name, Instrument Title, or Date.
- [x] Hook every Create/Update/Delete mutation to write a before/after snapshot into `audit_logs`.
- [x] Add **Print Register Page** view (`@media print` CSS) that formats entries 5-per-page with the branch name (`GenSan Branch` or `Malungon Branch`), physical header, 9 columns, and weekly certification footer ("I HEREBY CERTIFY...").

**Verification:** Creating an entry logs to `audit_logs`, updates the register table, and renders cleanly in Print Preview.

---

## Phase 4: Owner Audit Dashboard & Device Control Center
**Goal:** Give the owner full financial/entry oversight across all branches and one-click session control.

- [x] Build `/owner/dashboard` (KPI summary):
  - Total Fees Collected (`fee_amount` and `amount_paid` in PHP — Today / This Week / This Month) broken down by Branch (`GenSan Branch` vs `Malungon Branch`).
  - Total Notarized Instruments & breakdown by Notarial Act Type.
  - Recent Audit Trail feed (shows branch, edits, deletions, and blocked mobile login attempts).
- [x] Build `/owner/audit` (Master Register View):
  - Clearly displays the Branch (`GenSan Branch` or `Malungon Branch`) on every row, alongside both `fee_amount` and `amount_paid` (PHP).
  - Filterable across `GenSan Branch` and `Malungon Branch`, books, date ranges, and fee ranges.
  - Click any row to inspect its full edit history (`old_data` vs `new_data` diff).
  - Export filtered results to Excel (`.xlsx`) or CSV.
- [x] Build `/owner/devices` (Live Session & Device Manager):
  - Table of all **Active Sessions** showing: Branch Code, Device Type badge (`Desktop` / `Mobile` / `Tablet`), OS & Browser (e.g., `Windows 11 - Chrome`), IP Address, Last Seen, and Approval Status.
  - **Approve / Unapprove PC** toggle for each branch's bound computer.
  - **Force Logout** button that sets `is_active = false`, `revoked_at = now()`, immediately disconnecting that device.
- [x] Build `/owner/branches` to create new branch codes, reset branch passwords, and toggle `allow_mobile_login` per branch.

**Verification:** Owner can view all branch entries, see exact fee totals, approve a specific PC, and remotely force-logout another active browser session.

---

## Phase 5: Hardening & Deployment
- [ ] Add rate limiting on `/api/auth/login` to prevent brute-forcing branch codes.
- [ ] Enforce Row-Level Security (RLS) or strict server-side API route guards so a branch session can never query another branch's entries or owner routes.
- [ ] Deploy to Vercel with environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SESSION_SECRET`).