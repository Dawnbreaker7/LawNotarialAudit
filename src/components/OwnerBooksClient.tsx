"use client";

import { useState, type FormEvent } from "react";
import {
  BookOpen,
  CheckCircle2,
  Pencil,
  Plus,
  ShieldAlert,
  X,
} from "lucide-react";
import type { OwnerBookRow, OwnerBranchSummary } from "@/lib/owner/books";
import type { OperatingBranchCode } from "@/types/database";

interface OwnerBooksClientProps {
  initialBranches: OwnerBranchSummary[];
  initialBooks: OwnerBookRow[];
}

interface EditBookState {
  book: OwnerBookRow;
  notary_name: string;
  jurisdiction: string;
  appointment_date: string;
  commission_expiry: string;
  book_no: string;
  series_year: string;
  is_active: boolean;
}

interface NewBookFormState {
  branch_code: OperatingBranchCode;
  notary_name: string;
  jurisdiction: string;
  appointment_date: string;
  commission_expiry: string;
  book_no: string;
  series_year: string;
  is_active: boolean;
}

function formatDate(isoOrDate: string | null): string {
  if (!isoOrDate) return "Not set";
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function OwnerBooksClient({
  initialBranches,
  initialBooks,
}: OwnerBooksClientProps) {
  const [branches] = useState<OwnerBranchSummary[]>(initialBranches);
  const [books, setBooks] = useState<OwnerBookRow[]>(initialBooks);
  const [editModal, setEditModal] = useState<EditBookState | null>(null);
  const [createModalBranch, setCreateModalBranch] =
    useState<OperatingBranchCode | null>(null);
  const [newForm, setNewForm] = useState<NewBookFormState>({
    branch_code: "GENSAN",
    notary_name: "Atty. Venchito M. Bangayan",
    jurisdiction: "General Santos City, Philippines",
    appointment_date: "",
    commission_expiry: "",
    book_no: "",
    series_year: String(new Date().getFullYear()),
    is_active: true,
  });

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function refreshBooks() {
    const res = await fetch("/api/owner/books", { cache: "no-store" });
    const data = (await res.json()) as { books?: OwnerBookRow[] };
    if (res.ok && data.books) {
      setBooks(data.books);
    }
  }

  function openCreateModal(branchCode: OperatingBranchCode) {
    const existingForBranch = books.filter((b) => b.branch_code === branchCode);
    const maxBookNo = existingForBranch.reduce(
      (max, b) => Math.max(max, b.book_no),
      0
    );
    const defaultJurisdiction =
      branchCode === "GENSAN"
        ? "General Santos City, Philippines"
        : "Malungon, Sarangani, Philippines";

    setErrorMsg(null);
    setNewForm({
      branch_code: branchCode,
      notary_name:
        existingForBranch[0]?.notary_name ?? "Atty. Venchito M. Bangayan",
      jurisdiction:
        existingForBranch[0]?.jurisdiction ?? defaultJurisdiction,
      appointment_date: existingForBranch[0]?.appointment_date ?? "",
      commission_expiry: existingForBranch[0]?.commission_expiry ?? "",
      book_no: String(maxBookNo + 1),
      series_year: String(new Date().getFullYear()),
      is_active: true,
    });
    setCreateModalBranch(branchCode);
  }

  async function handleCreateBook(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/owner/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_code: newForm.branch_code,
          notary_name: newForm.notary_name.trim(),
          jurisdiction: newForm.jurisdiction.trim(),
          appointment_date: newForm.appointment_date || null,
          commission_expiry: newForm.commission_expiry || null,
          book_no: Number(newForm.book_no),
          series_year: Number(newForm.series_year),
          is_active: newForm.is_active,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? "Failed to create book.");
        return;
      }

      setCreateModalBranch(null);
      await refreshBooks();
      setSuccessMsg(
        `Created Book ${newForm.book_no} (Series of ${newForm.series_year}) for ${newForm.branch_code === "GENSAN" ? "GenSan Branch" : "Malungon Branch"}.`
      );
    } catch {
      setErrorMsg("Network error while creating book.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editModal) return;

    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/owner/books", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: editModal.book.id,
          notary_name: editModal.notary_name.trim(),
          jurisdiction: editModal.jurisdiction.trim(),
          appointment_date: editModal.appointment_date || null,
          commission_expiry: editModal.commission_expiry || null,
          book_no: Number(editModal.book_no),
          series_year: Number(editModal.series_year),
          is_active: editModal.is_active,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? "Failed to update book.");
        return;
      }

      setEditModal(null);
      await refreshBooks();
      setSuccessMsg("Updated book and notary details.");
    } catch {
      setErrorMsg("Network error while updating book.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSetActive(book: OwnerBookRow) {
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/owner/books", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id, is_active: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? "Failed to activate book.");
        return;
      }
      await refreshBooks();
      setSuccessMsg(
        `Book ${book.book_no} (Series of ${book.series_year}) is now active for ${book.branch_name}.`
      );
    } catch {
      setErrorMsg("Network error while activating book.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#1B2A4A]">
          Notarial Books &amp; Notary Public Management
        </h1>
        <p className="text-sm text-slate-600">
          Configure active Book numbers, Series years, and Notary Public
          metadata for GenSan Branch and Malungon Branch. Branches cannot edit
          these fields.
        </p>
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

      <div className="grid gap-6">
        {branches.map((branch) => {
          const branchBooks = books.filter(
            (bk) => bk.branch_code === branch.branch_code
          );

          return (
            <section
              key={branch.id}
              className="overflow-hidden rounded-xl border border-[#DFD7C8] bg-white shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE3D5] bg-[#FAF7F1] px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <BookOpen className="h-5 w-5 text-[#9A722C]" />
                  <h2 className="font-serif text-lg font-bold text-[#1B2A4A]">
                    {branch.branch_name}
                  </h2>
                  <span className="rounded border border-[#DFD7C8] bg-white px-2 py-0.5 font-mono text-xs text-[#1B2A4A]">
                    {branch.branch_code}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openCreateModal(branch.branch_code)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg bg-[#1B2A4A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#121D36] sm:w-auto"
                >
                  <Plus className="h-4 w-4 text-[#DFBE78]" />
                  New Book for {branch.branch_name}
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {branchBooks.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-slate-500">
                    No books created yet for {branch.branch_name}.
                  </p>
                ) : (
                  branchBooks.map((book) => (
                    <div
                      key={book.id}
                      className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-base font-bold tabular-nums text-[#1B2A4A]">
                            Book No. {book.book_no} &bull; Series of{" "}
                            {book.series_year}
                          </span>
                          {book.is_active ? (
                            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
                              Active Book
                            </span>
                          ) : (
                            <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                              Archived / Inactive
                            </span>
                          )}
                          <span className="rounded-full border border-[#DFD7C8] bg-[#FAF7F1] px-2.5 py-0.5 font-mono text-xs tabular-nums text-slate-700">
                            {book.entry_count} / 500 entries
                          </span>
                          {book.entry_count >= 500 && (
                            <span className="rounded-full border border-red-300 bg-[#FEF2F2] px-2.5 py-0.5 text-xs font-semibold text-[#7F1D1D]">
                              Full (500/500)
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-700">
                          <strong>Notary Public:</strong> {book.notary_name} &bull;{" "}
                          <strong>Jurisdiction:</strong> {book.jurisdiction}
                        </div>
                        <div className="font-mono text-xs tabular-nums text-slate-600">
                          Appointment: {formatDate(book.appointment_date)} &bull;
                          Commission Expiry: {formatDate(book.commission_expiry)}
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                        {!book.is_active && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleSetActive(book)}
                            className="min-h-[44px] w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 sm:w-auto"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setEditModal({
                              book,
                              notary_name: book.notary_name,
                              jurisdiction: book.jurisdiction,
                              appointment_date: book.appointment_date ?? "",
                              commission_expiry: book.commission_expiry ?? "",
                              book_no: String(book.book_no),
                              series_year: String(book.series_year),
                              is_active: book.is_active,
                            })
                          }
                          className="inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 text-xs font-semibold text-[#1B2A4A] hover:bg-[#FAF7F1] sm:w-auto"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit Details
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Create Book Modal */}
      {createModalBranch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-[94vw] overflow-y-auto rounded-xl border border-[#DFD7C8] bg-white shadow-xl sm:max-w-lg">
            <div className="flex items-center justify-between border-b border-[#EAE3D5] bg-[#FAF7F1] px-5 py-4 sm:px-6">
              <h3 className="font-serif text-lg font-bold text-[#1B2A4A]">
                New Notarial Book &mdash;{" "}
                {createModalBranch === "GENSAN"
                  ? "GenSan Branch"
                  : "Malungon Branch"}
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalBranch(null)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-slate-500 hover:bg-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateBook}
              className="space-y-4 p-5 sm:p-6"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Book No. *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newForm.book_no}
                    onChange={(e) =>
                      setNewForm({ ...newForm, book_no: e.target.value })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Series Year *
                  </label>
                  <input
                    type="number"
                    min={2000}
                    required
                    value={newForm.series_year}
                    onChange={(e) =>
                      setNewForm({ ...newForm, series_year: e.target.value })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                  Notary Public Name *
                </label>
                <input
                  type="text"
                  required
                  value={newForm.notary_name}
                  onChange={(e) =>
                    setNewForm({ ...newForm, notary_name: e.target.value })
                  }
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                  Jurisdiction *
                </label>
                <input
                  type="text"
                  required
                  value={newForm.jurisdiction}
                  onChange={(e) =>
                    setNewForm({ ...newForm, jurisdiction: e.target.value })
                  }
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Appointment Date
                  </label>
                  <input
                    type="date"
                    value={newForm.appointment_date}
                    onChange={(e) =>
                      setNewForm({
                        ...newForm,
                        appointment_date: e.target.value,
                      })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Commission Expiry
                  </label>
                  <input
                    type="date"
                    value={newForm.commission_expiry}
                    onChange={(e) =>
                      setNewForm({
                        ...newForm,
                        commission_expiry: e.target.value,
                      })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm"
                  />
                </div>
              </div>

              <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newForm.is_active}
                  onChange={(e) =>
                    setNewForm({ ...newForm, is_active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Set as the active book for this branch immediately
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-[#EAE3D5] pt-4 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalBranch(null)}
                  className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] px-4 py-2 text-sm font-medium text-[#1B2A4A] hover:bg-[#FAF7F1] sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[44px] w-full rounded-lg bg-[#1B2A4A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#121D36] disabled:opacity-60 sm:w-auto"
                >
                  {busy ? "Creating..." : "Create Book"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Book Modal */}
      {editModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-[94vw] overflow-y-auto rounded-xl border border-[#DFD7C8] bg-white shadow-xl sm:max-w-lg">
            <div className="flex items-center justify-between border-b border-[#EAE3D5] bg-[#FAF7F1] px-5 py-4 sm:px-6">
              <h3 className="font-serif text-lg font-bold text-[#1B2A4A]">
                Edit Book &mdash; {editModal.book.branch_name}
              </h3>
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-slate-500 hover:bg-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Book No. *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editModal.book_no}
                    onChange={(e) =>
                      setEditModal({ ...editModal, book_no: e.target.value })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Series Year *
                  </label>
                  <input
                    type="number"
                    min={2000}
                    required
                    value={editModal.series_year}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        series_year: e.target.value,
                      })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                  Notary Public Name *
                </label>
                <input
                  type="text"
                  required
                  value={editModal.notary_name}
                  onChange={(e) =>
                    setEditModal({ ...editModal, notary_name: e.target.value })
                  }
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                  Jurisdiction *
                </label>
                <input
                  type="text"
                  required
                  value={editModal.jurisdiction}
                  onChange={(e) =>
                    setEditModal({ ...editModal, jurisdiction: e.target.value })
                  }
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Appointment Date
                  </label>
                  <input
                    type="date"
                    value={editModal.appointment_date}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        appointment_date: e.target.value,
                      })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Commission Expiry
                  </label>
                  <input
                    type="date"
                    value={editModal.commission_expiry}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        commission_expiry: e.target.value,
                      })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm"
                  />
                </div>
              </div>

              <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editModal.is_active}
                  onChange={(e) =>
                    setEditModal({ ...editModal, is_active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Active Book for this branch
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-[#EAE3D5] pt-4 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] px-4 py-2 text-sm font-medium text-[#1B2A4A] hover:bg-[#FAF7F1] sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[44px] w-full rounded-lg bg-[#1B2A4A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#121D36] disabled:opacity-60 sm:w-auto"
                >
                  {busy ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
