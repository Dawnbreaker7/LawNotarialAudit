# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Branch Encoders (GenSan Branch & Malungon Branch):** Office staff operating on owner-approved desktop workstations who record daily notarized instruments, collect fees and acknowledgement receipts, upload supporting document scans/IDs, and generate `Judicial Form No. 143` printouts.
- **Owner / Supervising Notary Lawyer:** The legal practitioner overseeing both branches across office desktops and foldable mobile devices, responsible for approving branch devices/sessions, configuring active notarial books and commissions, auditing financial collections, reviewing scanned attachments side-by-side (`Approve` or `Flag with Note`), making audited corrections, and exporting registers.

## Product Purpose

Provide a tamper-evident, branch-separated notarial ledger and real-time lawyer audit portal across GenSan Branch and Malungon Branch that preserves a strict 1:1 digital replica of Philippine `Judicial Form No. 143 As Amended` while enabling remote verification and financial oversight.

## Positioning

Unlike generic office spreadsheets or editable CRUD databases, branch workstations operate strictly append-only with locked per-branch sequential entry numbers, mandatory workstation/device approval, private signed-URL document verification (`notarial-attachments`), and an immutable `audit_logs` diff trail exclusively controlled by the owner.

## Operating Context

- **Dual-Branch Daily Recording:** Encoders log instruments in real time during office hours (`Asia/Manila` UTC+8) against each branch's currently active Notarial Book and Series Year. The branch register defaults to today's entries with a quick toggle to inspect historical records.
- **Mandatory Pre-Upload Verification & Attachment Capture:** Encoders manually enter both Official Register Fee and Amount Paid (no auto-sync), optionally attach supporting scans/IDs (`JPG`, `PNG`, `WebP`, `PDF` up to 10 MB), and verify every field in a confirmation modal before locking the entry.
- **Physical Register Printing:** Every 5 consecutive entries map to 1 physical page of `Judicial Form No. 143 As Amended` printed in landscape (`0.4in` margins) without altering the official 9-column form layout.
- **Mobile & Foldable Lawyer Review:** The owner accesses KPIs, review queues, side-by-side attachment viewers, and print previews across a 360px folded cover screen, a 768px+ unfolded inner screen, and 1080p office desktops.

## Capabilities and Constraints

- **Strict Append-Only Branch Scope:** Branch sessions can only create entries and upload attachments to their own branch and active book; branches cannot edit, delete, or view attachments belonging to another branch.
- **Per-Branch Entry Uniqueness:** `entry_number` is enforced unique per `(branch_id, book_id)` with server-side conflict detection (`409 Conflict`) and next-available number recovery.
- **Private Storage Access:** Scanned documents and IDs are stored in a private Supabase Storage bucket (`notarial-attachments`) and served only via short-lived (15-minute) role-verified signed URLs.
- **Audit Logging:** All logins, blocked mobile/device attempts, device approvals/revocations, entry creations, lawyer approvals/flags, and owner edits (with mandatory edit reason and before/after diff snapshots) are persisted to `audit_logs`.
- **Print Preservation Constraint:** All screen theme updates, responsive adaptations, and owner audit controls must keep `@media print` output in `RegisterPrintSheet` 100% pure black-and-white 1:1 to `Judicial Form No. 143 As Amended`.
- **Technology Stack (Existing):** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres + Private Storage), and SheetJS (`xlsx`).

## Brand Commitments

- Keep the Notary Public name, jurisdiction, appointment date, commission expiry, Book No., and Series Year dynamically driven by each branch's active `notarial_books` record (currently configured for Atty. Venchito M. Bangayan), keeping portal titles clean and free of hardcoded firm monograms or logos.

## Product Principles

- **Audit Integrity Over Convenience:** Never compromise append-only guarantees, device approvals, manual dual-entry of fees and amounts paid, or required review notes when flagging discrepancies.
- **Zero Print Drift:** Treat the 1:1 `Judicial Form No. 143 As Amended` print layout as an immutable legal artifact regardless of viewport or screen theme changes.
- **Ergonomic Clarity Across Screens:** Keep every branch encoding step, owner audit filter, and lawyer verification modal fast, legible, and touch-safe (`min-h-[44px]`) from 360px cover screens to 1080p office monitors.

## Accessibility & Inclusion

- Minimum `44px` interactive touch targets (`min-h-[44px]`) and `16px` mobile input text (`text-base md:text-sm`) to prevent iOS/Android auto-zoom and mis-taps on foldable devices.
- Minimum WCAG AA contrast (`>= 4.5:1` for body text) and distinct icon + text + color pairings on all review statuses (`For Review`, `Approved`, `Flagged`, `Locked`).
