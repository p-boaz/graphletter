"use client";

import dynamic from "next/dynamic";

const Analytics = dynamic(
	() => import("@vercel/analytics/react").then((m) => m.Analytics),
	{ ssr: false },
);

export function LazyAnalytics() {
	return <Analytics />;
}
