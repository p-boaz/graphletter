"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { FrameworkCrosswalk } from "@/components/framework-crosswalk";
import { MappingExplorer } from "@/components/mapping-explorer";

export default function FrameworkExplorerPage() {
	return (
		<DashboardLayout
			title="Framework Explorer"
			description="Discover SCF controls, understand how they map across frameworks, and investigate crosswalk opportunities."
			showStatsCards={false}
			showUploadButton={false}
		>
			<div className="space-y-12">
				<section className="space-y-6">
					<MappingExplorer />
				</section>
				<section className="space-y-6">
					<FrameworkCrosswalk />
				</section>
			</div>
		</DashboardLayout>
	);
}
