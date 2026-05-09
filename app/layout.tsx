import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import type React from "react";
import "./globals.css";
import { Toaster as SonnerToaster } from "sonner";
import { LazyAnalytics } from "@/components/lazy-analytics";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import AuthProvider from "@/lib/auth/auth-context";

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
	display: "swap",
});

const playfair = Playfair_Display({
	subsets: ["latin"],
	variable: "--font-playfair",
	display: "swap",
});

export const metadata: Metadata = {
	title: "Graphletter — Compliance Analysis Engine",
	description:
		"Open compliance analysis engine that maps evidence against 79+ regulatory frameworks using SCF normalization and LLM-based assessment.",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html
			lang="en"
			className={`${inter.variable} ${playfair.variable}`}
			suppressHydrationWarning
		>
			<body className={inter.className}>
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
