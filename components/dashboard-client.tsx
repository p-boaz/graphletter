"use client";

import type { User as SupabaseUser } from "@supabase/supabase-js";
import { Building, Calendar, LogOut, Mail, Shield, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

interface DashboardClientProps {
  user: SupabaseUser;
}

export function DashboardClient({ user }: DashboardClientProps) {
  const userProfile = {
    id: user.id,
    email: user.email,
    fullName: user.user_metadata?.full_name || "Not provided",
    organization: user.user_metadata?.organization || "Not provided",
    createdAt: new Date(user.created_at).toLocaleDateString(),
    lastSignIn: user.last_sign_in_at
      ? new Date(user.last_sign_in_at).toLocaleDateString()
      : "Never",
    emailConfirmed: user.email_confirmed_at ? "Yes" : "No",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="rounded-xl bg-gradient-to-br from-ft-pink to-ft-cream p-3 shadow-lg">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="ft-serif font-bold text-3xl text-ft-black tracking-tight">
                Compliance Dashboard
              </h1>
              <p className="ft-sans text-ft-grey text-lg">Welcome back, {userProfile.fullName}!</p>
            </div>
          </div>
          <form action={signOut}>
            <Button
              type="submit"
              className="ft-button-secondary flex items-center space-x-2 text-ft-pink"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          </form>
        </div>

        <div className="ft-divider my-8" />
        {/* User Profile Card */}
        <div className="ft-card rounded-2xl shadow-lg border-2 border-ft-pink p-6">
          <div className="flex items-center mb-4">
            <User className="h-6 w-6 text-ft-pink mr-2" />
            <span className="ft-serif font-semibold text-xl text-ft-black">User Profile</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-base">
                <Mail className="h-4 w-4 text-ft-pink" />
                <span className="font-medium">Email:</span>
                <span>{userProfile.email}</span>
              </div>
              <div className="flex items-center space-x-2 text-base">
                <User className="h-4 w-4 text-ft-pink" />
                <span className="font-medium">Full Name:</span>
                <span>{userProfile.fullName}</span>
              </div>
              <div className="flex items-center space-x-2 text-base">
                <Building className="h-4 w-4 text-ft-pink" />
                <span className="font-medium">Organization:</span>
                <span>{userProfile.organization}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-base">
                <Calendar className="h-4 w-4 text-ft-pink" />
                <span className="font-medium">Account Created:</span>
                <span>{userProfile.createdAt}</span>
              </div>
              <div className="flex items-center space-x-2 text-base">
                <Calendar className="h-4 w-4 text-ft-pink" />
                <span className="font-medium">Last Sign In:</span>
                <span>{userProfile.lastSignIn}</span>
              </div>
              <div className="flex items-center space-x-2 text-base">
                <Shield className="h-4 w-4 text-ft-pink" />
                <span className="font-medium">Email Confirmed:</span>
                <Badge variant={userProfile.emailConfirmed === "Yes" ? "default" : "secondary"}>
                  {userProfile.emailConfirmed}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
