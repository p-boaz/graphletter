import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
	...nextCoreWebVitals,
	...nextTypescript,
	{
		ignores: ["scripts/**", "playwright/artifacts/**"],
	},
	{
		rules: {
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-require-imports": "off",
			"react/no-unescaped-entities": "warn",
			"react-hooks/set-state-in-effect": "warn",
			"react-hooks/purity": "warn",
			"react-hooks/immutability": "warn",
			"prefer-const": "warn",
		},
	},
	// Phase 1: Prevent bare console.log in production code
	{
		files: ["app/api/**/*.ts", "lib/**/*.ts"],
		rules: {
			"no-console": ["warn", { allow: ["warn", "error", "info", "debug"] }],
		},
	},
	// Phase 3: Import boundary enforcement
	{
		files: ["components/**/*.{ts,tsx}"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["@/app/api/*"],
							message:
								"Components must not import from API routes directly.",
						},
					],
				},
			],
		},
	},
	{
		files: ["app/api/**/*.ts"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["@/components/*"],
							message:
								"API routes must not import from components.",
						},
					],
				},
			],
		},
	},
	// Scripts get relaxed rules instead of being fully ignored
	{
		files: ["scripts/**"],
		rules: {
			"@typescript-eslint/no-require-imports": "off",
			"no-console": "off",
		},
	},
];

export default config;
