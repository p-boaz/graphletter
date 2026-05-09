import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const isCi =
	process.env.CI === "true" ||
	process.env.CI === "1" ||
	process.env.GITHUB_ACTIONS === "true";
const enforceTypeChecks = isCi || process.env.ENFORCE_TYPECHECK === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
	typescript: {
		ignoreBuildErrors: !enforceTypeChecks,
	},
	images: {
		unoptimized: true,
	},
	experimental: {
		optimizePackageImports: ["lucide-react", "react-icons", "recharts"],
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
};

export default nextConfig;
