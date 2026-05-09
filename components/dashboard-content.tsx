"use client";

import { Building, Calendar, LogOut, Mail, Shield, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";

export function DashboardContent() {
	const { user, signOut, loading } = useAuth();
	const router = useRouter();

	const userProfile = useMemo(() => {
		if (!user) return null;
		return {
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
	}, [user]);

	useEffect(() => {
		if (!loading && !user) {
			router.push("/auth");
		}
	}, [user, loading, router]);

	const handleSignOut = async () => {
		const { error } = await signOut();
		if (!error) {
			router.push("/auth");
		}
	};

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center">
					<div className="mx-auto h-8 w-8 animate-spin rounded-full border-slate-900 border-b-2"></div>
					<p className="mt-4 text-slate-600">Loading...</p>
				</div>
			</div>
		);
	}

	if (!user) {
		return null; // Will redirect to auth
	}

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
							<p className="ft-sans text-ft-grey text-lg">
								Welcome back, {userProfile?.fullName}!
							</p>
						</div>
					</div>
					<Button
						onClick={handleSignOut}
						className="ft-button-secondary flex items-center space-x-2"
					>
						<LogOut className="h-4 w-4" />
						<span className="text-ft-pink">Sign Out</span>
					</Button>
				</div>

				<div className="ft-divider my-8" />
				{/* Auth Test Success Card */}
				<div className="flex justify-center">
					<div className="ft-card rounded-2xl shadow-lg border-2 border-ft-pink bg-gradient-to-br from-green-100 to-green-50 p-6 flex flex-col items-center">
						<Shield className="h-8 w-8 text-green-600 mb-2" />
						<span className="ft-serif font-semibold text-xl text-green-800 mb-1">
							🎉 Authentication Test Successful!
						</span>
						<span className="ft-sans text-green-700 text-base">
							You have successfully signed in and your session is active.
						</span>
					</div>
				</div>

				<div className="ft-divider my-8" />
				{/* User Profile Card */}
				<div className="ft-card rounded-2xl shadow-lg border-2 border-ft-pink p-6">
					<div className="flex items-center mb-4">
						<User className="h-6 w-6 text-ft-pink mr-2" />
						<span className="ft-serif font-semibold text-xl text-ft-black">
							User Profile
						</span>
					</div>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<div className="flex items-center space-x-2 text-base">
								<Mail className="h-4 w-4 text-ft-pink" />
								<span className="font-medium">Email:</span>
								<span>{userProfile?.email}</span>
							</div>
							<div className="flex items-center space-x-2 text-base">
								<User className="h-4 w-4 text-ft-pink" />
								<span className="font-medium">Full Name:</span>
								<span>{userProfile?.fullName}</span>
							</div>
							<div className="flex items-center space-x-2 text-base">
								<Building className="h-4 w-4 text-ft-pink" />
								<span className="font-medium">Organization:</span>
								<span>{userProfile?.organization}</span>
							</div>
						</div>
						<div className="space-y-2">
							<div className="flex items-center space-x-2 text-base">
								<Calendar className="h-4 w-4 text-ft-pink" />
								<span className="font-medium">Account Created:</span>
								<span>{userProfile?.createdAt}</span>
							</div>
							<div className="flex items-center space-x-2 text-base">
								<Calendar className="h-4 w-4 text-ft-pink" />
								<span className="font-medium">Last Sign In:</span>
								<span>{userProfile?.lastSignIn}</span>
							</div>
							<div className="flex items-center space-x-2 text-base">
								<Shield className="h-4 w-4 text-ft-pink" />
								<span className="font-medium">Email Confirmed:</span>
								<Badge
									variant={
										userProfile?.emailConfirmed === "Yes"
											? "default"
											: "secondary"
									}
								>
									{userProfile?.emailConfirmed}
								</Badge>
							</div>
						</div>
					</div>
				</div>

				<div className="ft-divider my-8" />
				{/* User ID Card (for debugging) */}
				<div className="ft-card rounded-2xl shadow-lg border-2 border-ft-pink p-6">
					<div className="flex items-center mb-4">
						<User className="h-6 w-6 text-ft-pink mr-2" />
						<span className="ft-serif font-semibold text-xl text-ft-black">
							Technical Details
						</span>
					</div>
					<div className="rounded-lg bg-ft-cream p-3 font-mono text-base">
						<div>
							<strong>User ID:</strong> {userProfile?.id}
						</div>
					</div>
				</div>

				<div className="ft-divider my-8" />
				{/* Next Steps Card */}
				<div className="ft-card rounded-2xl shadow-lg border-2 border-ft-pink p-6">
					<div className="flex items-center mb-4">
						<span className="ft-serif font-semibold text-xl text-ft-black">
							🚀 Next Steps
						</span>
					</div>
					<div className="space-y-2 text-base">
						<div className="flex items-center space-x-2">
							<div className="h-2 w-2 rounded-full bg-green-500"></div>
							<span>✅ User authentication is working</span>
						</div>
						<div className="flex items-center space-x-2">
							<div className="h-2 w-2 rounded-full bg-blue-500"></div>
							<span>
								🔄 Next: Update document upload to save user-specific data
							</span>
						</div>
						<div className="flex items-center space-x-2">
							<div className="h-2 w-2 rounded-full bg-blue-500"></div>
							<span>🔄 Next: Build user compliance tracking</span>
						</div>
						<div className="flex items-center space-x-2">
							<div className="h-2 w-2 rounded-full bg-blue-500"></div>
							<span>🔄 Next: Add Row Level Security (RLS) policies</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
