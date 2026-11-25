import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import {
  getDefaultRedirect,
  getValidSession,
  isSessionApproved,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const valid = await getValidSession({ touchLastSeen: false });
  if (valid) {
    redirect(getDefaultRedirect(valid.branch.role, isSessionApproved(valid)));
  }

  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4EE] px-4 py-12">
      <LoginForm reason={params.reason} />
    </main>
  );
}
