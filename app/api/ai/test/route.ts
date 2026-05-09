import { NextResponse } from "next/server";
import { testProvider } from "@/lib/ai-client";
import {
	AI_PROVIDERS,
	type AIProvider,
	getProviderConfig,
} from "@/lib/ai-config";
import {
	enforceUserRateLimit,
	requireAuthenticatedUser,
} from "@/utils/api-guards";

interface ProviderTestResult {
	success: boolean;
	message: string;
	error?: string;
	durationMs: number;
}

export async function GET() {
	try {
		const authResult = await requireAuthenticatedUser();
		if ("response" in authResult) {
			return authResult.response;
		}

		const rateLimited = enforceUserRateLimit({
			scope: "ai:test",
			userId: authResult.user.id,
			limit: 5,
			windowMs: 60_000,
		});
		if (rateLimited) {
			return rateLimited;
		}

		const config = getProviderConfig();
		const providerEntries: Array<{
			key: keyof typeof config;
			provider: AIProvider;
		}> = [
			{ key: "openai", provider: AI_PROVIDERS.OPENAI },
			{ key: "anthropic", provider: AI_PROVIDERS.ANTHROPIC },
		];

		const tests: Record<string, ProviderTestResult> = {};
		const availableProviders: AIProvider[] = [];

		for (const { key, provider } of providerEntries) {
			const providerConfig = config[key];
			if (!providerConfig?.available) {
				tests[provider] = {
					success: false,
					message: `${provider} API key not configured`,
					error: "Missing API key",
					durationMs: 0,
				};
				continue;
			}

			availableProviders.push(provider);

			const start = Date.now();
			const result = await testProvider(provider);
			const durationMs = Date.now() - start;

			tests[provider] = {
				...result,
				durationMs,
			};
		}

		const successfulProviders = availableProviders.filter(
			(provider) => tests[provider]?.success,
		);
		const overallSuccess =
			availableProviders.length > 0 &&
			successfulProviders.length === availableProviders.length;

		return NextResponse.json({
			success: overallSuccess,
			availableProviders,
			tests,
			successfulProviders,
			timestamp: new Date().toISOString(),
			message:
				availableProviders.length === 0
					? "No AI providers configured"
					: overallSuccess
						? "All configured AI providers responded successfully"
						: successfulProviders.length > 0
							? "Some AI providers are available"
							: "AI providers failed connectivity checks",
		});
	} catch (error) {
		console.error("AI connectivity test failed", error);
		return NextResponse.json(
			{
				success: false,
				availableProviders: [],
				tests: {},
				message: "AI connectivity test failed",
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	}
}
