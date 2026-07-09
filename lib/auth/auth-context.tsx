"use client";

import type { User } from "@supabase/supabase-js";
import type React from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => ({ error: null }),
});

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const hasInitializedAuth = useRef(false);
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    const getUser = async () => {
      // Paint from the locally-stored session first — getUser() is a network
      // round-trip, and gating the header on it left the avatar as a skeleton
      // for seconds on every load (QA 2026-07-09 ISSUE-008).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (!session) {
        // No session to validate; calling getUser() would just 401.
        setUser(null);
        hasInitializedAuth.current = true;
        setLoading(false);
        return;
      }

      setUser(session.user);
      hasInitializedAuth.current = true;
      setLoading(false);

      // Background validation against the auth server; corrects stale sessions.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!isMounted) return;
      setUser(user);
    };

    void getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      if (hasInitializedAuth.current) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return {
      error: error ? new Error(error.message) : null,
    };
  };

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
