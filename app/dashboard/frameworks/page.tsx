"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { FrameworkCrosswalk } from "@/components/framework-crosswalk";
import { MappingExplorer } from "@/components/mapping-explorer";

export default function FrameworkExplorerPage() {
  return (
    <DashboardLayout
      title="Framework Explorer"
      description="Browse the controls behind every framework and see how one piece of evidence crosswalks to many requirements."
      showStatsCards={false}
      showUploadButton={false}
    >
      <div className="space-y-12">
        <section className="space-y-6">
          <MappingExplorer embedded />
        </section>
        <section className="space-y-6">
          <FrameworkCrosswalk />
        </section>
      </div>
    </DashboardLayout>
  );
}
