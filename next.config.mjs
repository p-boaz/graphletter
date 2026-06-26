import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const isCi =
	process.env.CI === "true" ||
	process.env.CI === "1" ||
	process.env.GITHUB_ACTIONS === "true";
const enforceTypeChecks = isCi || process.env.ENFORCE_TYPECHECK === "1";
const securityHeaders = [
	{
		key: "Content-Security-Policy",
		value: [
			"default-src 'self'",
			"base-uri 'self'",
			"form-action 'self'",
			"frame-ancestors 'none'",
			"object-src 'none'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
			"style-src 'self' 'unsafe-inline' https:",
			"img-src 'self' data: blob: https:",
			"font-src 'self' data: https:",
			"connect-src 'self' https: wss:",
		].join("; "),
	},
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{
		key: "Permissions-Policy",
		value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
	},
];

/** @type {import('next').NextConfig} */
const nextConfig = {
	typescript: {
		ignoreBuildErrors: !enforceTypeChecks,
	},
	images: {
		unoptimized: true,
	},
	experimental: {
		optimizePackageImports: ["lucide-react", "react-icons"],
	},
	// Exclude specific Node.js-dependent packages from Edge Runtime
	serverExternalPackages: ["@supabase/supabase-js"],
	// Pin project root explicitly so Turbopack never infers /app as workspace root.
	turbopack: {
		root: configDir,
	},
	webpack: (config, { isServer }) => {
		// Optimize webpack caching of large strings
		if (isServer) {
			config.experiments = {
				...config.experiments,
				topLevelAwait: true,
			};
		}
		return config;
	},
	async headers() {
		return [
			{
				source: "/:path*",
				headers: securityHeaders,
			},
		];
	},
};

export default nextConfig;
