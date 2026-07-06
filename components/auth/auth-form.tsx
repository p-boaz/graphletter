"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signIn, signUp } from "@/lib/auth/actions";
import type { AuthTab } from "@/lib/auth/auth-tabs";

export function AuthForm({
  initialTab = "signin",
  nextPath,
  defaults,
}: {
  initialTab?: AuthTab;
  nextPath?: string;
  defaults?: { name?: string; email?: string };
}) {
  return (
    <Card className="mx-auto w-full max-w-md" data-testid="auth-form">
      <CardHeader className="text-center">
        <CardTitle>Welcome</CardTitle>
        <CardDescription>Sign in to your account or create a new one</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin" data-testid="auth-tab-signin">
              Sign In
            </TabsTrigger>
            <TabsTrigger value="signup" data-testid="auth-tab-signup">
              Sign Up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-4">
            <form action={signIn} className="space-y-4" data-testid="signin-form">
              {nextPath && <input type="hidden" name="next" value={nextPath} />}
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  data-testid="signin-email-input"
                  id="signin-email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  defaultValue={defaults?.email ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  data-testid="signin-password-input"
                  id="signin-password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" data-testid="signin-submit-button">
                Sign In
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            <form action={signUp} className="space-y-4" data-testid="signup-form">
              {nextPath && <input type="hidden" name="next" value={nextPath} />}
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name</Label>
                <Input
                  data-testid="signup-name-input"
                  id="signup-name"
                  name="full_name"
                  type="text"
                  placeholder="Enter your full name"
                  defaultValue={defaults?.name ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-organization">Organization</Label>
                <Input
                  data-testid="signup-organization-input"
                  id="signup-organization"
                  name="organization"
                  type="text"
                  placeholder="Enter your organization"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  data-testid="signup-email-input"
                  id="signup-email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  defaultValue={defaults?.email ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  data-testid="signup-password-input"
                  id="signup-password"
                  name="password"
                  type="password"
                  placeholder="Create a password"
                  aria-describedby="signup-password-hint"
                  required
                />
                <p
                  className="mt-1 text-[11px] text-slate-500"
                  data-testid="signup-password-hint"
                  id="signup-password-hint"
                >
                  Use 8 or more characters with a mix of letters and numbers.
                </p>
              </div>
              <Button type="submit" className="w-full" data-testid="signup-submit-button">
                Sign Up
              </Button>
              <p className="pt-1 text-[11px] text-slate-500" data-testid="signup-terms">
                By creating an account you agree to our{" "}
                <a className="underline" href="/terms" target="_blank" rel="noopener noreferrer">
                  Terms
                </a>{" "}
                and{" "}
                <a className="underline" href="/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>
                .
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
