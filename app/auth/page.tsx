import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { AlertBanner } from "@/components/ui/alert-banner";
import { parseAuthTab } from "@/lib/auth/auth-tabs";
import { pageTitle } from "@/lib/seo/page-title";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: pageTitle("Sign in") };

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string;
    error?: string;
    tab?: string;
    next?: string;
    name?: string;
    email?: string;
  }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const { message, error, tab, next, name, email } = await searchParams;
  const initialTab = parseAuthTab(tab);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <Navigation />
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <AuthForm initialTab={initialTab} nextPath={next} defaults={{ name, email }} />
          {message && <AlertBanner tone="success">{message}</AlertBanner>}
          {error && (
            <AlertBanner tone="danger" testId="auth-error">
              {error}
            </AlertBanner>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
