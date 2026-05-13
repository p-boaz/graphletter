"use client";

import { BarChart3, CheckCircle, FileText, GitBranch, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EvidenceSummaryCard } from "@/components/evidence-summary-card";
import { Navigation } from "@/components/navigation";
import { SmartEvidenceUpload } from "@/components/smart-evidence-upload";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const oneWeekAgoThreshold = Date.now() - ONE_WEEK_MS;

interface EvidenceRecord {
  id: string;
  file_name: string;
  scf_control_id: string;
  evidence_type: string;
  evidence_status: string;
  submitted_at: string;
  evidence_group_id?: string;
  erl_global_id?: string;
  metadata?: {
    documentation_artifact?: string;
    smart_upload?: boolean;
  };
}

interface AssessmentRecord {
  id: string;
  evidence_id?: string;
  scf_control_id: string;
  assessment_result: string;
  assessment_status: string;
  assessment_notes: string;
  completed_at: string;
  metadata?: {
    confidence?: number;
    ai_generated?: boolean;
    objective_results?: Array<{
      result: string;
      confidence: number;
      reasoning: string;
    }>;
  };
  scf_controls?: {
    title: string;
    description: string;
  };
  linked_evidence?: Array<{
    id: string;
    file_name: string;
    evidence_type: string;
  }>;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
  showStatsCards?: boolean;
  showUploadButton?: boolean;
  actions?: React.ReactNode;
}

export function DashboardLayout({
  children,
  title,
  description,
  showStatsCards = false,
  showUploadButton = true,
  actions,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [evidenceRecords, setEvidenceRecords] = useState<EvidenceRecord[]>([]);
  const [assessmentRecords, setAssessmentRecords] = useState<AssessmentRecord[]>([]);

  const loadEvidenceData = useCallback(async () => {
    try {
      // Load evidence records
      const evidenceResponse = await fetch(`/api/evidence/history`, {
        cache: "no-store",
      });
      if (evidenceResponse.ok) {
        const evidenceData = await evidenceResponse.json();
        setEvidenceRecords(evidenceData.evidence || []);
      }

      // Load assessment records
      const assessmentResponse = await fetch(`/api/assessments/history`, {
        cache: "no-store",
      });
      if (assessmentResponse.ok) {
        const assessmentData = await assessmentResponse.json();
        setAssessmentRecords(assessmentData.assessments || []);
      }
    } catch (error) {
      console.error("Error loading evidence data:", error);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadEvidenceData();
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadEvidenceData]);

  // Calculate dashboard stats
  const totalEvidenceFiles = [...new Set(evidenceRecords.map((e) => e.evidence_group_id || e.id))]
    .length;
  const totalEvidenceRecords = evidenceRecords.length;
  const completedAssessments = assessmentRecords.filter(
    (a) => a.assessment_status === "completed"
  ).length;
  const uniqueControlsWithEvidence = [...new Set(evidenceRecords.map((e) => e.scf_control_id))]
    .length;
  const recentUploadGroups = [
    ...new Set(
      evidenceRecords
        .filter((e) => {
          const uploadDate = new Date(e.submitted_at);
          return uploadDate.getTime() > oneWeekAgoThreshold;
        })
        .map((e) => e.evidence_group_id || e.id)
    ),
  ].length;

  // Calculate control-level statistics
  const controlAssessmentMap = new Map<string, AssessmentRecord[]>();
  assessmentRecords
    .filter((a) => a.assessment_status === "completed")
    .forEach((assessment) => {
      const controlId = assessment.scf_control_id;
      if (!controlAssessmentMap.has(controlId)) {
        controlAssessmentMap.set(controlId, []);
      }
      controlAssessmentMap.get(controlId)!.push(assessment);
    });

  const getControlOverallResult = (assessments: AssessmentRecord[]) => {
    if (assessments.length === 0) return "not_applicable";
    const results = assessments.map((a) => a.assessment_result);
    if (results.every((r) => r === "pass")) return "pass";
    if (results.every((r) => r === "fail")) return "fail";
    if (results.some((r) => r === "pass")) return "partial";
    return "fail";
  };

  const controlResults = Array.from(controlAssessmentMap.entries()).map(
    ([controlId, assessments]) => ({
      controlId,
      overallResult: getControlOverallResult(assessments),
      assessmentCount: assessments.length,
      assessments,
    })
  );

  const passedControls = controlResults.filter((c) => c.overallResult === "pass").length;
  const totalAssessedControls = controlResults.length;
  const dashboardNavItems = [
    {
      href: "/dashboard",
      label: "Overview",
      testId: "dashboard-nav-tab-overview",
      icon: BarChart3,
    },
    {
      href: "/dashboard/evidence",
      label: "Evidence Records",
      testId: "dashboard-nav-tab-evidence",
      icon: FileText,
    },
    {
      href: "/dashboard/assessments",
      label: "Assessment Results",
      testId: "dashboard-nav-tab-assessments",
      icon: CheckCircle,
    },
    {
      href: "/dashboard/compliance-posture",
      label: "Compliance Posture",
      testId: "dashboard-nav-tab-compliance-posture",
      icon: Shield,
    },
    {
      href: "/dashboard/analytics",
      label: "Analytics",
      testId: "dashboard-nav-tab-analytics",
      icon: BarChart3,
    },
    {
      href: "/dashboard/frameworks",
      label: "Framework Explorer",
      testId: "dashboard-nav-tab-frameworks",
      icon: GitBranch,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="ft-container space-y-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="ft-serif font-bold text-4xl text-ft-black leading-tight lg:text-5xl">
              {title}
            </h1>
            <p className="ft-sans mt-2 text-slate-600 text-xl leading-relaxed">{description}</p>
          </div>
          <div className="flex items-center gap-3">
            {showUploadButton && <SmartEvidenceUpload onEvidenceProcessed={loadEvidenceData} />}
            {/* <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="ft-button-primary">
                  <Download className="mr-2 h-4 w-4" />
                  Export Report
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportReport("csv")}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportReport("json")}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu> */}
            {actions}
          </div>
        </div>

        {/* Dashboard Navigation */}
        <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
          {dashboardNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={item.testId}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={(event) => {
                  if (pathname === item.href) {
                    return;
                  }
                  event.preventDefault();
                  router.push(item.href);
                }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Stats Cards */}
        {showStatsCards && (
          <div className="ft-grid grid-cols-1 gap-12 md:grid-cols-4 mb-12 px-2 md:px-6">
            <EvidenceSummaryCard
              title="Evidence Files"
              label="Evidence Overview"
              totalEvidenceFiles={totalEvidenceFiles}
              totalEvidenceRecords={totalEvidenceRecords}
              percentage={100}
              description="Total unique evidence files and records uploaded."
            />
            <EvidenceSummaryCard
              title="Assessed Controls"
              label="Assessment Progress"
              totalEvidenceFiles={totalAssessedControls}
              totalEvidenceRecords={completedAssessments}
              percentage={Math.round((passedControls / (totalAssessedControls || 1)) * 100)}
              description="Assessed controls and completed assessments."
            />
            <EvidenceSummaryCard
              title="Recent Uploads"
              label="Recent Evidence Groups"
              totalEvidenceFiles={recentUploadGroups}
              totalEvidenceRecords={0}
              percentage={Math.round((recentUploadGroups / (totalEvidenceFiles || 1)) * 100)}
              description="Evidence groups uploaded in the last 7 days."
            />
            <EvidenceSummaryCard
              title="Coverage"
              label="Control Coverage"
              totalEvidenceFiles={uniqueControlsWithEvidence}
              totalEvidenceRecords={totalEvidenceFiles}
              percentage={Math.round(
                (uniqueControlsWithEvidence / (totalAssessedControls || 1)) * 100
              )}
              description="Controls covered by at least one evidence file."
            />
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}
