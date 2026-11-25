---
name: Notarial Register & Branch Audit System
description: Modern Legal & Archival Precision design system for GenSan Branch, Malungon Branch, and the Owner Legal Portal.
colors:
  legal-navy: "#1B2A4A"
  legal-navy-deep: "#121D36"
  antique-gold: "#B48A3E"
  antique-gold-soft: "#FBF5E8"
  alabaster-canvas: "#F7F4EE"
  archival-surface: "#FFFFFF"
  parchment-subtle: "#FAF7F1"
  parchment-muted: "#F4EFE4"
  hairline-stone: "#DFD7C8"
  ink-body: "#1C2434"
  slate-muted: "#64748B"
  status-approved-fg: "#065F46"
  status-approved-bg: "#ECFDF5"
  status-review-fg: "#78350F"
  status-review-bg: "#FFFBEB"
  status-flagged-fg: "#7F1D1D"
  status-flagged-bg: "#FEF2F2"
  status-locked-fg: "#1E293B"
  status-locked-bg: "#F1F5F9"
typography:
  display:
    fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif'
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  headline:
    fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif'
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  mono-tabular:
    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace'
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: '"tnum" 1'
  label:
    fontFamily: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  md: "8px"
  lg: "12px"
  pill: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.legal-navy}"
    textColor: "{colors.archival-surface}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.legal-navy-deep}"
  button-secondary:
    backgroundColor: "{colors.archival-surface}"
    textColor: "{colors.legal-navy}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.archival-surface}"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "44px"
  card-archival:
    backgroundColor: "{colors.archival-surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: Notarial Register & Branch Audit System

## Overview

**Creative North Star: "Archival Ledger & Chambers Precision"**

Built for daily high-accuracy legal encoding in GenSan and Malungon offices and rapid mobile/desktop lawyer review, this system pairs warm alabaster paper surfaces with crisp `1px` hairline borders, authoritative legal-navy primary actions, and antique-gold editorial accents. Heavy SaaS gradients, deep drop shadows, and decorative ornament stay out of the workspace so encoded legal facts, attachments, and PHP amounts read effortlessly.

Screen portals use the Chambers alabaster/navy palette across desktop and foldable phones (`360px` cover screen through `1080p` desktop), while `@media print` in `RegisterPrintSheet` remains strictly black-and-white (`#000000` on `#FFFFFF` in `'Times New Roman', Times, serif`) as an exact 1:1 replica of Philippine `Judicial Form No. 143 As Amended`.

**Key Characteristics:**
- Warm alabaster page canvas supporting crisp white `1px` hairline cards
- Deep legal-navy primary surfaces with restrained antique-gold accents
- Monospace tabular numerals (`tabular-nums`) for every Entry No., Book/Page number, timestamp, Acknowledgement Receipt, and PHP (`₱`) amount
- High-contrast icon + label semantic pills (`For Review`, `Approved`, `Flagged`, `Locked`, `Desktop Only`)
- Touch-first `44px` interactive minimums and zero-zoom `16px` mobile inputs below `768px`

## Colors

The palette anchors all operational clarity in warm parchment neutrals and deep legal-navy ink, reserving saturated chromatic hues strictly for legal review statuses and security alerts.

### Primary
- **Legal Navy** (`#1B2A4A`): Top sticky navigation bar, primary action buttons (`Sign In`, `Review & Verify`, `Apply`, `Confirm`, `Print`), and page headings.
- **Deep Chambers Navy** (`#121D36`): Hover and pressed states for primary navy actions, plus active icon container wells.

### Secondary
- **Antique Gold** (`#B48A3E` / soft tint `#FBF5E8`): Navigation bar bottom hairline rule, keyboard `:focus-visible` ring, shield/gavel icon accents, and the highlighted **For Lawyer Review** verification queue card.

### Neutral
- **Alabaster Canvas** (`#F7F4EE`): Outer screen page backdrop across Login, Pending Approval, Branch Register, and Owner Portal views.
- **Archival White** (`#FFFFFF`): Elevated form panels, ledger tables, review modals, and mobile cards.
- **Parchment Subtle & Muted** (`#FAF7F1` / `#F4EFE4`): Table headers, read-only metadata wells, and secondary comparison tiles.
- **Hairline Stone Border** (`#DFD7C8`): Uniform `1px` borders framing cards, modals, and dividers.
- **Charcoal Ink & Muted Slate** (`#1C2434` / `#64748B`): Primary body copy and secondary field labels/timestamps (`>= 4.5:1` contrast).

### Named Rules
**The Status Clarity Rule.** Saturated amber (`#FFFBEB` / `#78350F`), emerald (`#ECFDF5` / `#065F46`), crimson (`#FEF2F2` / `#7F1D1D`), and slate (`#F1F5F9` / `#1E293B`) are reserved exclusively for semantic entry statuses, security policies (`Desktop Only`), and financial total highlights—never as decorative card fills.

**The Pure Print Rule.** Inside `@media print`, all alabaster backgrounds and navy surfaces collapse to pure `#FFFFFF` paper and `#000000` ink so `Judicial Form No. 143 As Amended` prints cleanly on physical register stock.

## Typography

**Display & Section Font:** `Georgia` / `Cambria` / `"Times New Roman"` serif
**UI Body Font:** `"Plus Jakarta Sans"` (with `ui-sans-serif, system-ui, sans-serif` fallback)
**Numeric & Code Font:** `"JetBrains Mono"` with `tabular-nums` (`font-variant-numeric: tabular-nums`)

**Character:** Serif page/section titles convey judicial permanence and pair cleanly with a sharp humanist sans-serif for rapid form scanning and tabular monospace figures for aligned financial columns.

### Hierarchy
- **Display / Page Title** (`700`, `1.25rem–1.5rem`, `line-height: 1.25`): Main page headers (`Notarial Register`, `Owner Financial & Audit Dashboard`, `Master Register Audit`).
- **Headline / Card Title** (`700`, `1.125rem`, `line-height: 1.3`): Major section containers (`Encode New Notarial Entry`, `Uploaded Register Entries`, modal headers).
- **Body** (`400–500`, `0.875rem` desktop / `1rem` mobile inputs, `line-height: 1.5`): Form fields, party names, instrument descriptions, and review notes.
- **Mono Tabular** (`500–700`, `0.75rem–1.25rem`, `tabular-nums`): Entry `#`, Book/Page/Series numbers, Acknowledgement Receipt codes, timestamps, and all `₱` amounts (`fee_amount`, `amount_paid`).
- **Label** (`600`, `0.75rem`, `+0.05em`, uppercase): Form field labels and table column headers.

### Named Rules
**The Tabular Ledger Rule.** Every Entry Number, Book/Page number, timestamp, Acknowledgement Receipt, and PHP (`₱`) currency value must carry `tabular-nums` (paired with `font-mono` in ledger cells and KPI totals) so vertical columns align digit-for-digit.

## Layout

Content lives inside centered `max-w-7xl` containers (`16px` mobile / `24px` desktop horizontal padding) with predictable `24px` vertical section spacing and generous card internal padding (`20px–24px`).

- **360px Folded Cover Screen (`< 768px`):** Multi-column tables convert cleanly to stacked summary cards (`md:hidden`), navigation shows horizontal quick-tabs plus a collapsible menu drawer, modals expand to `94vw–95vw` with stacked side-by-side attachment/detail sections, and inputs stay `>= 16px` (`text-base`) with `44px` minimum height.
- **768px+ Unfolded Inner Screen & 1080p Desktop (`md:` / `lg:`):** Full 5-item sticky navigation bar, multi-column filter grids, horizontal `overflow-x-auto` register tables, and 12-column side-by-side Lawyer Review workspace (7-col attachment preview alongside 5-col metadata & approve/flag actions).

## Elevation & Depth

Depth is expressed through surface contrast (`#FFFFFF` cards against `#F7F4EE` alabaster canvas) and `1px` hairline borders (`#DFD7C8`) rather than heavy drop shadows. Only `shadow-xs` is applied to top-level cards, while modals sit over a `rgba(2, 6, 23, 0.6)` backdrop (`shadow-xl`) to protect review focus.

## Shapes

- **Cards, Filter Bars & Modals:** `12px` radius (`rounded-xl`) with uniform `1px` full borders (`#DFD7C8`). Never apply thick one-sided accent bars on rounded containers.
- **Buttons, Inputs & Selects:** `8px` radius (`rounded-lg`) with `44px` minimum height on interactive touch controls.
- **Status & Branch Pills:** Full pill radius (`9999px`) with matching `1px` border and leading Lucide icon.

## Components

### Buttons
- **Shape:** Gently rounded (`8px` radius), `min-h-[44px]` for mobile/modal actions.
- **Primary:** Legal Navy fill (`#1B2A4A`) with crisp white text and optional antique-gold leading icon (`#DFBE78`).
- **Hover / Focus:** Shifts to Deep Chambers Navy (`#121D36`) on hover; `2px` antique-gold (`#B48A3E`) outline on `:focus-visible`.
- **Secondary / Destructive:** Crisp white fill (`#FFFFFF`) with hairline stone border (`#D8D0C0`) and `#1B2A4A` text (`#FAF7F1` hover); emerald (`#15803D`) for `Approve Entry` / `Export Excel` and crimson (`#DC2626`) for `Flag with Note` / `Delete`.

### Chips & Status Badges
- **For Review:** `#FFFBEB` fill, `#FCD34D` border, `#78350F` text, clock icon.
- **Approved:** `#ECFDF5` fill, `#6EE7B7` border, `#065F46` text, check-circle icon.
- **Flagged:** `#FEF2F2` fill, `#FCA5A5` border, `#7F1D1D` text, flag icon.
- **Locked:** `#F1F5F9` fill, `#CBD5E1` border, `#1E293B` text, lock icon.
- **Desktop Only:** `#ECFDF5` fill, `#6EE7B7` border, `#065F46` text.

### Cards / Containers
- **Corner Style:** `12px` radius (`rounded-xl`).
- **Background:** `#FFFFFF` on `#F7F4EE` canvas; `#FAF7F1` for nested metric wells.
- **Border:** Uniform `1px solid #DFD7C8`.
- **Internal Padding:** `20px`–`24px`.

### Inputs / Fields
- **Style:** `1px solid #D8D0C0`, `#FFFFFF` background (or `#FAF7F1/50` on Auth), `8px` radius, `min-h-[44px]`.
- **Focus:** Border shifts to `#1B2A4A` with `2px` `#B48A3E` focus-visible outline.

### Navigation
- Sticky `#1B2A4A` top bar anchored by a `2px` `#B48A3E` bottom rule, gold-tinted shield emblem, desktop pill links (`#121D36` active state with `#F4DDA8` text), and mobile horizontal quick-tabs + drawer toggle below `768px`.

## Do's and Don'ts

### Do:
- **Do** format every Entry No., Book/Page number, timestamp, Acknowledgement Receipt, and PHP currency value with `tabular-nums`.
- **Do** enforce uniform `1px` `#DFD7C8` hairline borders around cards and `min-h-[44px]` on mobile touch targets.
- **Do** pair color with an icon and clear text label on all status badges (`For Review`, `Approved`, `Flagged`, `Locked`).

### Don't:
- **Don't** alter `RegisterPrintSheet` colors, borders, or `Times New Roman` typography—`@media print` must remain pure black-and-white 1:1 `Judicial Form No. 143 As Amended`.
- **Don't** add SaaS gradients, glassmorphism, or thick one-sided accent bars (`border-l-4` / `border-t-4`) on rounded cards.
- **Don't** place font sizes smaller than `16px` (`text-base`) on mobile `<input>` / `<select>` controls.
