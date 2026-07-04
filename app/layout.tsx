import type { Metadata } from "next";
import type React from "react";
import "./globals.css";
import { Toaster as SonnerToaster } from "sonner";
import { LazyAnalytics } from "@/components/lazy-analytics";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import AuthProvider from "@/lib/auth/auth-context";

export const metadata: Metadata = {
  title: "Graphletter — Compliance Analysis Engine",
  description:
    "Upload your policies and evidence — Graphletter checks them against SOC 2, ISO 27001, NIST, and 76 other frameworks, and shows exactly what passes, what's missing, and why.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster />
            <SonnerToaster position="bottom-right" richColors />
          </AuthProvider>
        </ThemeProvider>
        <LazyAnalytics />
      </body>
    </html>
  );
}
