"use client";

import {
	AlertTriangle,
	Brain,
	CheckCircle,
	Loader2,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AIStatusDetails {
	success?: boolean;
	availableProviders?: string[];
	successfulProviders?: string[];
	tests?: Record<string, { success: boolean }>;
	error?: string;
	message?: string;
}

export function AIStatusIndicator() {
	const [status, setStatus] = useState<
		"checking" | "connected" | "partial" | "error"
	>("checking");
	const [details, setDetails] = useState<AIStatusDetails | null>(null);

	const checkAIStatus = useCallback(async () => {
		try {
			const response = await fetch("/api/ai/test");
			const result = await response.json();

			if (!response.ok) {
				setStatus("error");
				setDetails(result);
				return;
			}

			const availableProviders = result.availableProviders || [];
			const workingProviders = (result.successfulProviders || []).length;
			const totalProviders = availableProviders.length;

			if (totalProviders === 0) {
				setStatus("error");
			} else if (result.success) {
				setStatus("connected");
			} else if (workingProviders > 0) {
				setStatus("partial");
			} else {
				setStatus("error");
			}

			setDetails(result);
		} catch {
			setStatus("error");
			setDetails({ error: "Failed to connect to AI services" });
		}
	}, []);

	useEffect(() => {
		const timeout = setTimeout(() => {
			void checkAIStatus();
		}, 0);
		return () => clearTimeout(timeout);
	}, [checkAIStatus]);

	const getStatusIcon = () => {
		switch (status) {
			case "checking":
				return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
			case "connected":
				return <CheckCircle className="h-4 w-4 text-emerald-600" />;
			case "partial":
				return <AlertTriangle className="h-4 w-4 text-amber-600" />;
			case "error":
				return <XCircle className="h-4 w-4 text-red-500" />;
		}
	};

	const getStatusBadge = () => {
		switch (status) {
			case "checking":
				return (
					<Badge className="border border-blue-200 bg-blue-50 text-blue-700">
						Checking...
					</Badge>
				);
			case "connected":
				return (
					<Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
						All Connected
					</Badge>
				);
			case "partial":
				return (
					<Badge className="border border-amber-200 bg-amber-50 text-amber-700">
						Partially Connected
					</Badge>
				);
			case "error":
				return (
					<Badge className="border border-red-200 bg-red-50 text-red-700">
						Error
					</Badge>
				);
		}
	};

	const getProviderStatus = (provider: string) => {
		if (!details?.tests?.[provider]) return null;

		const test = details.tests[provider];
		return (
			<div key={provider} className="flex items-center justify-between text-xs">
				<span className="text-slate-600 capitalize">{provider}:</span>
				<span className={test.success ? "text-emerald-600" : "text-red-500"}>
					{test.success ? "✓ Connected" : "✗ Failed"}
				</span>
			</div>
		);
	};

	return (
		<Card className="border border-slate-200 border-l-4 border-l-blue-400 bg-white">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="flex items-center space-x-2 font-medium text-slate-800 text-sm">
					<Brain className="h-4 w-4 text-slate-600" />
					<span>AI Integration Status</span>
				</CardTitle>
				{getStatusBadge()}
			</CardHeader>
			<CardContent>
				<div className="mb-2 flex items-center space-x-2">
					{getStatusIcon()}
					<span className="text-slate-700 text-sm">
						{status === "checking" && "Testing AI providers..."}
						{status === "connected" && "All AI services operational"}
						{status === "partial" && "Some AI services available"}
						{status === "error" && "AI services unavailable"}
					</span>
				</div>

				{details?.availableProviders && (
					<div className="mb-2 space-y-1">
						{details.availableProviders.map((provider: string) =>
							getProviderStatus(provider),
						)}
					</div>
				)}

				{status === "error" && (
					<div className="mb-2 text-red-600 text-xs">
						{details?.error || details?.message || "Unknown error"}
						{details?.message && details?.error && (
							<div className="mt-1">{details.message}</div>
						)}
					</div>
				)}

				<Button
					size="sm"
					variant="outline"
					onClick={() => {
						setStatus("checking");
						void checkAIStatus();
					}}
					className="mt-2 border-slate-300 text-slate-700 hover:bg-slate-50"
					disabled={status === "checking"}
				>
					{status === "checking" ? "Testing..." : "Test Again"}
				</Button>
			</CardContent>
		</Card>
	);
}
