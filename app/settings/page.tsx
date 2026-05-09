"use client";

import { Bell, Check, Eye, EyeOff, Lock, Shield, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth/auth-context";

export default function SettingsPage() {
	const { user } = useAuth();
	const [showPassword, setShowPassword] = useState(false);
	const [notifications, setNotifications] = useState({
		email: true,
		browser: true,
		assessmentComplete: true,
		evidenceApproval: true,
		systemUpdates: false,
		marketing: false,
	});

	const [profile, setProfile] = useState({
		firstName: "",
		lastName: "",
		email: "",
		company: "",
		role: "",
		timezone: "America/New_York",
		language: "en",
	});

	useEffect(() => {
		if (!user) {
			return;
		}

		const fullName =
			typeof user.user_metadata?.full_name === "string"
				? user.user_metadata.full_name.trim()
				: "";
		const nameParts = fullName.split(/\s+/).filter(Boolean);
		const firstName = nameParts[0] || "";
		const lastName = nameParts.slice(1).join(" ");
		const organization =
			typeof user.user_metadata?.organization === "string"
				? user.user_metadata.organization
				: "";
		const role =
			typeof user.user_metadata?.role === "string"
				? user.user_metadata.role
				: "";
		const timezone =
			typeof user.user_metadata?.timezone === "string"
				? user.user_metadata.timezone
				: "America/New_York";

		setProfile((current) => ({
			...current,
			firstName,
			lastName,
			email: user.email || "",
			company: organization,
			role,
			timezone,
		}));
	}, [user]);

	const handleNotificationChange = (key: string, value: boolean) => {
		setNotifications((prev) => ({ ...prev, [key]: value }));
	};

	const handleProfileChange = (key: string, value: string) => {
		setProfile((prev) => ({ ...prev, [key]: value }));
	};

	return (
		<div className="min-h-screen bg-white">
			<Navigation />

			{/* Hero Section */}
			<section className="bg-gradient-to-br from-slate-50 to-white py-12">
				<div className="container mx-auto px-4">
					<div className="text-center space-y-8">
						<h1 className="ft-serif font-bold text-4xl text-slate-900 lg:text-5xl">
							Account Settings
						</h1>
						<p className="ft-sans text-slate-600 text-xl max-w-3xl mx-auto">
							Manage your account preferences, security settings, and
							notification preferences to customize your Graphletter experience.
						</p>
					</div>
				</div>
			</section>

			{/* Settings Content */}
			<section className="py-10">
				<div className="container mx-auto px-4">
					<div className="max-w-4xl mx-auto">
						<Tabs defaultValue="profile" className="space-y-8">
							<TabsList className="grid w-full grid-cols-5">
								<TabsTrigger value="profile">Profile</TabsTrigger>
								<TabsTrigger value="security">Security</TabsTrigger>
								<TabsTrigger value="notifications">Notifications</TabsTrigger>
								<TabsTrigger value="billing">Billing</TabsTrigger>
							</TabsList>

							<TabsContent value="profile" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle className="ft-serif flex items-center">
											<User className="mr-2 h-5 w-5" />
											Profile Information
										</CardTitle>
										<CardDescription>
											Update your personal information and account details
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label htmlFor="firstName">First Name</Label>
												<Input
													id="firstName"
													value={profile.firstName}
													onChange={(e) =>
														handleProfileChange("firstName", e.target.value)
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="lastName">Last Name</Label>
												<Input
													id="lastName"
													value={profile.lastName}
													onChange={(e) =>
														handleProfileChange("lastName", e.target.value)
													}
												/>
											</div>
										</div>

										<div className="space-y-2">
											<Label htmlFor="email">Email Address</Label>
											<Input
												id="email"
												type="email"
												value={profile.email}
												onChange={(e) =>
													handleProfileChange("email", e.target.value)
												}
											/>
										</div>

										<div className="space-y-2">
											<Label htmlFor="company">Company</Label>
											<Input
												id="company"
												value={profile.company}
												onChange={(e) =>
													handleProfileChange("company", e.target.value)
												}
											/>
										</div>

										<div className="space-y-2">
											<Label htmlFor="role">Role</Label>
											<Input
												id="role"
												value={profile.role}
												onChange={(e) =>
													handleProfileChange("role", e.target.value)
												}
											/>
										</div>

										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label htmlFor="timezone">Timezone</Label>
												<Select
													value={profile.timezone}
													onValueChange={(value) =>
														handleProfileChange("timezone", value)
													}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="America/New_York">
															Eastern Time (ET)
														</SelectItem>
														<SelectItem value="America/Chicago">
															Central Time (CT)
														</SelectItem>
														<SelectItem value="America/Denver">
															Mountain Time (MT)
														</SelectItem>
														<SelectItem value="America/Los_Angeles">
															Pacific Time (PT)
														</SelectItem>
														<SelectItem value="Europe/London">
															London (GMT)
														</SelectItem>
														<SelectItem value="Europe/Paris">
															Paris (CET)
														</SelectItem>
														<SelectItem value="Asia/Tokyo">
															Tokyo (JST)
														</SelectItem>
														<SelectItem value="Asia/Singapore">
															Singapore (SGT)
														</SelectItem>
													</SelectContent>
												</Select>
											</div>

											<div className="space-y-2">
												<Label htmlFor="language">Language</Label>
												<Select
													value={profile.language}
													onValueChange={(value) =>
														handleProfileChange("language", value)
													}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="en">English</SelectItem>
														<SelectItem value="es">Spanish</SelectItem>
														<SelectItem value="fr">French</SelectItem>
														<SelectItem value="de">German</SelectItem>
														<SelectItem value="ja">Japanese</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>

										<div className="flex justify-end pt-4">
											<Button>Save Changes</Button>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="security" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle className="ft-serif flex items-center">
											<Lock className="mr-2 h-5 w-5" />
											Password & Authentication
										</CardTitle>
										<CardDescription>
											Manage your password and two-factor authentication
											settings
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-6">
										<div className="space-y-4">
											<div className="space-y-2">
												<Label htmlFor="currentPassword">
													Current Password
												</Label>
												<div className="relative">
													<Input
														id="currentPassword"
														type={showPassword ? "text" : "password"}
														placeholder="Enter current password"
													/>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
														onClick={() => setShowPassword(!showPassword)}
													>
														{showPassword ? (
															<EyeOff className="h-4 w-4" />
														) : (
															<Eye className="h-4 w-4" />
														)}
													</Button>
												</div>
											</div>

											<div className="space-y-2">
												<Label htmlFor="newPassword">New Password</Label>
												<Input
													id="newPassword"
													type="password"
													placeholder="Enter new password"
												/>
											</div>

											<div className="space-y-2">
												<Label htmlFor="confirmPassword">
													Confirm New Password
												</Label>
												<Input
													id="confirmPassword"
													type="password"
													placeholder="Confirm new password"
												/>
											</div>

											<Button>Update Password</Button>
										</div>

										<Separator />

										<div className="space-y-4">
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label className="text-base">
														Two-Factor Authentication
													</Label>
													<p className="text-sm text-slate-600">
														Add an extra layer of security to your account
													</p>
												</div>
												<Switch />
											</div>

											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label className="text-base">
														Login Notifications
													</Label>
													<p className="text-sm text-slate-600">
														Get notified when someone signs into your account
													</p>
												</div>
												<Switch defaultChecked />
											</div>
										</div>
									</CardContent>
								</Card>

								<Card>
									<CardHeader>
										<CardTitle className="ft-serif flex items-center">
											<Shield className="mr-2 h-5 w-5" />
											Active Sessions
										</CardTitle>
										<CardDescription>
											Monitor and manage your active login sessions
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="space-y-4">
											<div className="flex items-center justify-between p-4 border rounded-lg">
												<div className="space-y-1">
													<p className="font-medium">Current Session</p>
													<p className="text-sm text-slate-600">
														Chrome on macOS • New York, NY
													</p>
													<p className="text-xs text-slate-500">
														Last activity: Just now
													</p>
												</div>
												<div className="flex items-center">
													<Check className="h-4 w-4 text-green-600 mr-2" />
													<span className="text-sm text-green-600">Active</span>
												</div>
											</div>

											<div className="flex items-center justify-between p-4 border rounded-lg">
												<div className="space-y-1">
													<p className="font-medium">Mobile App</p>
													<p className="text-sm text-slate-600">
														iOS Safari • New York, NY
													</p>
													<p className="text-xs text-slate-500">
														Last activity: 2 hours ago
													</p>
												</div>
												<Button variant="outline" size="sm">
													Revoke
												</Button>
											</div>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="notifications" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle className="ft-serif flex items-center">
											<Bell className="mr-2 h-5 w-5" />
											Notification Preferences
										</CardTitle>
										<CardDescription>
											Choose how you want to be notified about account activity
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-6">
										<div className="space-y-4">
											<h4 className="font-medium">Delivery Methods</h4>
											<div className="space-y-4">
												<div className="flex items-center justify-between">
													<div className="space-y-0.5">
														<Label className="text-base">
															Email Notifications
														</Label>
														<p className="text-sm text-slate-600">
															Receive notifications via email
														</p>
													</div>
													<Switch
														checked={notifications.email}
														onCheckedChange={(checked) =>
															handleNotificationChange("email", checked)
														}
													/>
												</div>

												<div className="flex items-center justify-between">
													<div className="space-y-0.5">
														<Label className="text-base">
															Browser Notifications
														</Label>
														<p className="text-sm text-slate-600">
															Show notifications in your browser
														</p>
													</div>
													<Switch
														checked={notifications.browser}
														onCheckedChange={(checked) =>
															handleNotificationChange("browser", checked)
														}
													/>
												</div>
											</div>
										</div>

										<Separator />

										<div className="space-y-4">
											<h4 className="font-medium">Notification Types</h4>
											<div className="space-y-4">
												<div className="flex items-center justify-between">
													<div className="space-y-0.5">
														<Label className="text-base">
															Assessment Completed
														</Label>
														<p className="text-sm text-slate-600">
															When compliance assessments are finished
														</p>
													</div>
													<Switch
														checked={notifications.assessmentComplete}
														onCheckedChange={(checked) =>
															handleNotificationChange(
																"assessmentComplete",
																checked,
															)
														}
													/>
												</div>

												<div className="flex items-center justify-between">
													<div className="space-y-0.5">
														<Label className="text-base">
															Evidence Approval
														</Label>
														<p className="text-sm text-slate-600">
															When evidence is approved or needs review
														</p>
													</div>
													<Switch
														checked={notifications.evidenceApproval}
														onCheckedChange={(checked) =>
															handleNotificationChange(
																"evidenceApproval",
																checked,
															)
														}
													/>
												</div>

												<div className="flex items-center justify-between">
													<div className="space-y-0.5">
														<Label className="text-base">System Updates</Label>
														<p className="text-sm text-slate-600">
															Platform updates and maintenance notifications
														</p>
													</div>
													<Switch
														checked={notifications.systemUpdates}
														onCheckedChange={(checked) =>
															handleNotificationChange("systemUpdates", checked)
														}
													/>
												</div>

												<div className="flex items-center justify-between">
													<div className="space-y-0.5">
														<Label className="text-base">
															Marketing Communications
														</Label>
														<p className="text-sm text-slate-600">
															Product updates and promotional content
														</p>
													</div>
													<Switch
														checked={notifications.marketing}
														onCheckedChange={(checked) =>
															handleNotificationChange("marketing", checked)
														}
													/>
												</div>
											</div>
										</div>

										<div className="flex justify-end pt-4">
											<Button>Save Preferences</Button>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="billing" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle className="ft-serif">Current Plan</CardTitle>
										<CardDescription>
											Manage your subscription and billing information
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-6">
										<div className="flex items-center justify-between p-6 bg-blue-50 rounded-lg">
											<div>
												<h3 className="font-semibold text-lg">
													Enterprise Plan
												</h3>
												<p className="text-slate-600">
													$299/month • Billed annually
												</p>
												<p className="text-sm text-slate-500">
													Next billing date: February 15, 2024
												</p>
											</div>
											<Button variant="outline">Change Plan</Button>
										</div>

										<div className="space-y-4">
											<h4 className="font-medium">Plan Features</h4>
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div className="flex items-center space-x-2">
													<Check className="h-4 w-4 text-green-600" />
													<span className="text-sm">Unlimited assessments</span>
												</div>
												<div className="flex items-center space-x-2">
													<Check className="h-4 w-4 text-green-600" />
													<span className="text-sm">
														50+ compliance frameworks
													</span>
												</div>
												<div className="flex items-center space-x-2">
													<Check className="h-4 w-4 text-green-600" />
													<span className="text-sm">Advanced AI analysis</span>
												</div>
												<div className="flex items-center space-x-2">
													<Check className="h-4 w-4 text-green-600" />
													<span className="text-sm">Priority support</span>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>

								<Card>
									<CardHeader>
										<CardTitle className="ft-serif">Payment Methods</CardTitle>
										<CardDescription>
											Manage your payment methods and billing address
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="flex items-center justify-between p-4 border rounded-lg">
											<div className="flex items-center space-x-3">
												<div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
													<span className="text-xs font-bold text-blue-600">
														VISA
													</span>
												</div>
												<div>
													<p className="font-medium">•••• •••• •••• 4242</p>
													<p className="text-sm text-slate-600">
														Expires 12/2027
													</p>
												</div>
											</div>
											<div className="flex gap-2">
												<Button variant="outline" size="sm">
													Edit
												</Button>
												<Button variant="outline" size="sm">
													Remove
												</Button>
											</div>
										</div>

										<Button variant="outline">Add Payment Method</Button>
									</CardContent>
								</Card>

								<Card>
									<CardHeader>
										<CardTitle className="ft-serif text-red-600">
											Danger Zone
										</CardTitle>
										<CardDescription>
											Irreversible actions that will affect your account
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
											<div>
												<p className="font-medium text-red-900">
													Cancel Subscription
												</p>
												<p className="text-sm text-red-600">
													Your subscription will remain active until the end of
													the billing period
												</p>
											</div>
											<Button variant="destructive" size="sm">
												Cancel
											</Button>
										</div>

										<div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
											<div>
												<p className="font-medium text-red-900">
													Delete Account
												</p>
												<p className="text-sm text-red-600">
													Permanently delete your account and all associated
													data
												</p>
											</div>
											<Button variant="destructive" size="sm">
												Delete
											</Button>
										</div>
									</CardContent>
								</Card>
							</TabsContent>
						</Tabs>
					</div>
				</div>
			</section>

			<Footer />
		</div>
	);
}
