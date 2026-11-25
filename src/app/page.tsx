import { redirect } from "next/navigation";
import { getDefaultRedirect, getValidSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const valid = await getValidSession({ touchLastSeen: false });
  if (!valid) {
    redirect("/login");
  }
  redirect(
    getDefaultRedirect(valid.branch.role, Boolean(valid.device?.is_approved))
  );
}
