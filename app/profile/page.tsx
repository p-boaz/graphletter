import { Building, Calendar, Mail, Shield, User } from "lucide-react";
import { redirect } from "next/navigation";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

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
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <User className="h-16 w-16 text-slate-700" />
            </div>
            <h1 className="ft-serif font-bold text-4xl text-slate-900">User Profile</h1>
            <p className="ft-sans text-slate-600 text-xl max-w-2xl mx-auto">
              Manage your account information and settings
            </p>
          </div>

          {/* User Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="ft-serif text-2xl flex items-center space-x-2">
                <Shield className="h-6 w-6" />
                <span>Account Information</span>
              </CardTitle>
              <CardDescription className="ft-sans text-base text-slate-600 leading-relaxed">
                Your account details and authentication status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Mail className="h-5 w-5 text-slate-500" />
                    <div>
                      <span className="ft-sans font-medium text-slate-900">Email</span>
                      <p className="ft-sans text-slate-600">{userProfile.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-slate-500" />
                    <div>
                      <span className="ft-sans font-medium text-slate-900">Full Name</span>
                      <p className="ft-sans text-slate-600">{userProfile.fullName}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Building className="h-5 w-5 text-slate-500" />
                    <div>
                      <span className="ft-sans font-medium text-slate-900">Organization</span>
                      <p className="ft-sans text-slate-600">{userProfile.organization}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-slate-500" />
                    <div>
                      <span className="ft-sans font-medium text-slate-900">Account Created</span>
                      <p className="ft-sans text-slate-600">{userProfile.createdAt}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-slate-500" />
                    <div>
                      <span className="ft-sans font-medium text-slate-900">Last Sign In</span>
                      <p className="ft-sans text-slate-600">{userProfile.lastSignIn}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Shield className="h-5 w-5 text-slate-500" />
                    <div>
                      <span className="ft-sans font-medium text-slate-900">Email Status</span>
                      <div className="mt-1">
                        <Badge
                          variant={userProfile.emailConfirmed === "Yes" ? "default" : "secondary"}
                        >
                          {userProfile.emailConfirmed === "Yes" ? "Verified" : "Unverified"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
}
