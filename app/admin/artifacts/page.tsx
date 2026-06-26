import Link from "next/link";
import { AdminArtifactsClient } from "./admin-artifacts-client";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdminUser } from "@/utils/auth";

function AdminDenied({ reason }: { reason: "unauthorized" | "forbidden" }) {
  const title = reason === "unauthorized" ? "Sign in required" : "Admin access required";
  const message =
    reason === "unauthorized"
      ? "You must be signed in with an admin account to access SCF artifact administration."
      : "Your account is not allowlisted for administrative artifact editing.";

  return (
    <div className="mx-auto max-w-3xl p-8" data-testid="admin-artifacts-denied">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="font-bold text-2xl text-slate-900">{title}</h1>
        <p className="mt-2 text-slate-600">{message}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex rounded-md border border-slate-300 px-3 py-2 text-slate-700 text-sm hover:bg-slate-50"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default async function AdminArtifactsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return <AdminDenied reason="unauthorized" />;
  }

  if (!(await isAdminUser(user))) {
    return <AdminDenied reason="forbidden" />;
  }

  return <AdminArtifactsClient />;
}
