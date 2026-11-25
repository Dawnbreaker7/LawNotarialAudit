import OwnerBooksClient from "@/components/OwnerBooksClient";
import { fetchOwnerBooksSnapshot } from "@/lib/owner/books";

export const dynamic = "force-dynamic";

export default async function OwnerBooksPage() {
  const snapshot = await fetchOwnerBooksSnapshot();
  return (
    <OwnerBooksClient
      initialBranches={snapshot.branches}
      initialBooks={snapshot.books}
    />
  );
}
