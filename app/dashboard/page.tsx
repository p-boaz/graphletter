"use client";

import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle,
  Clock,
  FileX,
  Inbox,
  Target,
  Upload,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { FirstRunHero } from "@/components/dashboard/first-run-hero";
import { EnhancedControlCardContainer } from "@/components/enhanced-control-card-container";
import { GapRemediationPanel } from "@/components/gap-remediation/gap-remediation-panel";
import { SmartEvidenceUpload } from "@/components/smart-evidence-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isNewUser } from "@/lib/dashboard/is-new-user";
import { useEvidenceCount } from "@/lib/dashboard/use-evidence-count";
import { cn } from "@/lib/utils";

interface OverallStats {
  total_controls: number;
  with_evidence: number;
  passed_assessments: number;
  coverage_percentage: number;
}

interface TopGap {
  control_id: string;
  control_title: string;
  domain_id: string;
  has_evidence: boolean;
  has_assessment: boolean;
  assessment_result: string | null;
  last_updated: string | null;
  gap_type:
    | "no_evidence"
    | "no_assessment"
    | "failed_assessment"
    | "partial_compliance"
    | "conflicting_evidence"
    | "compliant";
}

interface GapSummary {
  fully_covered: number;
  partially_covered: number;
  no_evidence: number;
  conflicting_evidence: number;
}

interface FrameworkFilter {
  framework_name?: string;
  framework_version?: string;
  filtered: boolean;
}

interface ArtifactRecommendation {
  artifact_name: string;
  artifact_description: string;
  erl_id: string;
  covered_controls_count: number;
  covered_controls: string[];
  impact_score: number;
  control_details: Array<{
    control_id: string;
    control_title: string;
    domain_id: string;
    gap_type: string;
    has_evidence: boolean;
    has_assessment: boolean;
  }>;
}

interface ArtifactRecommendations {
  artifacts: ArtifactRecommendation[];
  total_gap_controls: number;
  total_recommendations: number;
}

interface ComplianceGapsData {
  framework_filter?: FrameworkFilter;
  overall_stats: OverallStats;
  top_gaps: TopGap[];
  gap_summary: GapSummary;
  artifact_recommendations?: ArtifactRecommendations;
}

interface Framework {
  id: string;
  framework_name: string;
  framework_version: string;
  total_mappings: number;
}

interface GraphCoverageControl {
  scf_control_id: string;
  status: "compliant" | "partial" | "missing" | "conflicting";
  strongest_coverage_rank: number;
}

interface GraphCoverageResponse {
  success?: boolean;
  error?: string;
  coverage?: {
    total_controls: number;
    covered_controls: number;
    partial_controls: number;
    missing_controls: number;
    conflicting_controls?: number;
    coverage_percentage: number;
  };
  controls?: GraphCoverageControl[];
}

interface AssessmentHistoryRecord {
  scf_control_id: string;
  assessment_status: string;
}

interface ScfControlCatalogItem {
  id: string;
  title: string;
  description?: string | null;
  domain_id: string;
}

const FEATURED_FRAMEWORK_PATTERNS: Array<{ displayLabel: string; slug: string; test: RegExp }> = [
  { displayLabel: "PCI DSS", slug: "pci-dss", test: /^PCI DSS$/i },
  { displayLabel: "NIST CSF", slug: "nist-csf", test: /^NIST CSF$/i },
  { displayLabel: "ISO 27001", slug: "iso-27001", test: /^ISO 27001$/i },
  { displayLabel: "HIPAA", slug: "hipaa", test: /HIPAA Security Rule/i },
  { displayLabel: "GDPR", slug: "gdpr", test: /EU GDPR/i },
  { displayLabel: "CCPA", slug: "ccpa", test: /CCPA\/CPRA/i },
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resolveFrameworkFromParam = (value: string | null, frameworks: Framework[]): string => {
  if (!value || value === "all") return "all";
  if (UUID_PATTERN.test(value) && frameworks.some((fw) => fw.id === value)) {
    return value;
  }
  const featured = FEATURED_FRAMEWORK_PATTERNS.find((p) => p.slug === value.toLowerCase());
  if (featured) {
    const match = frameworks
      .filter((fw) => featured.test.test(fw.framework_name))
      .sort((a, b) => b.total_mappings - a.total_mappings)[0];
    if (match) return match.id;
  }
  return "all";
};

const frameworkToParamValue = (id: string, frameworks: Framework[]): string | null => {
  if (id === "all") return null;
  const fw = frameworks.find((f) => f.id === id);
  if (!fw) return id;
  const featured = FEATURED_FRAMEWORK_PATTERNS.find((p) => p.test.test(fw.framework_name));
  return featured?.slug ?? id;
};

const graphStatusToGapType = (status: GraphCoverageControl["status"]): TopGap["gap_type"] => {
  if (status === "conflicting") return "conflicting_evidence";
  if (status === "missing") return "no_evidence";
  if (status === "partial") return "partial_compliance";
  return "compliant";
};

const graphStatusPriority: Record<TopGap["gap_type"], number> = {
  no_evidence: 0,
  failed_assessment: 1,
  no_assessment: 2,
  partial_compliance: 3,
  conflicting_evidence: 4,
  compliant: 5,
};

const formatCoveragePercent = (value: number) => {
  if (value > 0 && value < 1) return "<1%";
  return `${value}%`;
};

function RedirectHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab) {
      const routeMap: Record<string, string> = {
        evidence: "/dashboard/evidence",
        assessments: "/dashboard/assessments",
        analytics: "/dashboard/analytics",
      };

      const newRoute = routeMap[tab];
      if (newRoute) {
        router.replace(newRoute);
        return;
      }
    }
  }, [searchParams, router]);

  return null;
}

function ComplianceGaps() {
  const [gapsData, setGapsData] = useState<ComplianceGapsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controlCatalog, setControlCatalog] = useState<ScfControlCatalogItem[]>([]);
  const [controlCatalogReady, setControlCatalogReady] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<string>("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedArtifactName, setSelectedArtifactName] = useState<string>("");
  const [uploadDefaults, setUploadDefaults] = useState<{
    artifact?: string;
    description?: string;
  }>({});
  const [currentPage, setCurrentPage] = useState(1);
  const evidenceCount = useEvidenceCount();
  const itemsPerPage = 6;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const frameworkParam = searchParams.get("framework");

  const changeFramework = useCallback(
    (nextId: string) => {
      setSelectedFramework(nextId);
      const params = new URLSearchParams(searchParams.toString());
      const paramValue = frameworkToParamValue(nextId, frameworks);
      if (paramValue === null) {
        params.delete("framework");
      } else {
        params.set("framework", paramValue);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [frameworks, pathname, router, searchParams]
  );

  const loadFrameworks = async () => {
    try {
      const response = await fetch("/api/scf/frameworks");
      if (response.ok) {
        const frameworkData = await response.json();
        setFrameworks(frameworkData || []);
      }
    } catch (err) {
      console.error("Error loading frameworks:", err);
    }
  };

  const loadControlCatalog = async () => {
    try {
      const response = await fetch("/api/scf/controls?limit=all");
      if (!response.ok) {
        throw new Error("Failed to load SCF control catalog");
      }
      const controls = await response.json();
      setControlCatalog(Array.isArray(controls) ? controls : []);
    } catch (err) {
      console.error("Error loading SCF controls:", err);
      setControlCatalog([]);
    } finally {
      setControlCatalogReady(true);
    }
  };

  const loadGapsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const frameworkId = selectedFramework !== "all" ? selectedFramework : undefined;

      const analysisBody = frameworkId ? { frameworkId } : {};
      const coverageBody = frameworkId
        ? { frameworkId, includeControls: true }
        : { includeControls: true };

      const analysisPromise = fetch("/api/analysis/run-gap-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysisBody),
      })
        .then((response) => {
          if (!response.ok) {
            console.warn("Gap analysis refresh failed while loading dashboard:", response.status);
          }
        })
        .catch((analysisError) => {
          console.warn("Gap analysis refresh failed while loading dashboard:", analysisError);
        });

      const coverageResponse = await fetch("/api/controls/build-coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coverageBody),
      });
      const assessmentsResponse = await fetch("/api/assessments/history", {
        cache: "no-store",
      });
      await analysisPromise;

      const coverageData = (await coverageResponse.json()) as GraphCoverageResponse;
      if (!coverageResponse.ok || !coverageData.success) {
        throw new Error(coverageData.error || "Failed to load graph coverage data");
      }

      const controls = (coverageData.controls || []) as GraphCoverageControl[];
      const scopedControlIds = new Set(controls.map((control) => control.scf_control_id));
      let assessedControlIds = new Set<string>();
      if (assessmentsResponse.ok) {
        const assessmentsPayload = (await assessmentsResponse.json()) as {
          assessments?: AssessmentHistoryRecord[];
        };
        assessedControlIds = new Set(
          (assessmentsPayload.assessments || [])
            .filter((assessment) => assessment.assessment_status === "completed")
            .map((assessment) => assessment.scf_control_id)
            .filter((controlId) => scopedControlIds.has(controlId))
        );
      }
      const assessedControlsCount = assessedControlIds.size;
      const controlsById = new Map(controlCatalog.map((control) => [control.id, control]));

      const topGaps: TopGap[] = controls
        .map((control) => {
          const metadata = controlsById.get(control.scf_control_id);
          const gapType = graphStatusToGapType(control.status);
          return {
            control_id: control.scf_control_id,
            control_title: metadata?.title || `Control ${control.scf_control_id}`,
            domain_id: metadata?.domain_id || "Unknown",
            has_evidence: control.status !== "missing",
            has_assessment: assessedControlIds.has(control.scf_control_id),
            assessment_result:
              control.status === "compliant"
                ? "pass"
                : control.status === "conflicting"
                  ? "fail"
                  : control.status === "partial"
                    ? "partial"
                    : "fail",
            last_updated: null,
            gap_type: gapType,
          };
        })
        .sort((a, b) => {
          const priorityDiff = graphStatusPriority[a.gap_type] - graphStatusPriority[b.gap_type];
          if (priorityDiff !== 0) {
            return priorityDiff;
          }
          return a.control_id.localeCompare(b.control_id);
        });

      const coveredControls =
        coverageData.coverage?.covered_controls ||
        controls.filter((control) => control.status === "compliant").length;
      const partialControls =
        coverageData.coverage?.partial_controls ||
        controls.filter((control) => control.status === "partial").length;
      const missingControls =
        coverageData.coverage?.missing_controls ||
        controls.filter((control) => control.status === "missing").length;
      const conflictingControls =
        coverageData.coverage?.conflicting_controls ||
        controls.filter((control) => control.status === "conflicting").length;
      const totalControls = coverageData.coverage?.total_controls || controls.length;
      const withEvidence = coveredControls + partialControls;
      const framework = frameworks.find((item) => item.id === selectedFramework);

      const graphDrivenGapsData: ComplianceGapsData = {
        framework_filter:
          selectedFramework === "all"
            ? { filtered: false }
            : {
                filtered: true,
                framework_name: framework?.framework_name || "Selected framework",
                framework_version: framework?.framework_version,
              },
        overall_stats: {
          total_controls: totalControls,
          with_evidence: withEvidence,
          passed_assessments: coveredControls,
          coverage_percentage:
            coverageData.coverage?.coverage_percentage ??
            (totalControls > 0 ? Math.round((withEvidence / totalControls) * 100) : 0),
        },
        top_gaps: topGaps,
        gap_summary: {
          fully_covered: coveredControls,
          partially_covered: partialControls,
          no_evidence: missingControls,
          conflicting_evidence: conflictingControls,
        },
        artifact_recommendations: {
          artifacts: [],
          total_gap_controls: missingControls + partialControls + conflictingControls,
          total_recommendations: 0,
        },
      };

      setGapsData(graphDrivenGapsData);
    } catch (err) {
      console.error("Error loading gaps data:", err);
      setError("Failed to load compliance coverage");
    } finally {
      setLoading(false);
    }
  }, [selectedFramework, controlCatalog, frameworks]);

  useEffect(() => {
    void Promise.all([loadFrameworks(), loadControlCatalog()]);
  }, []);

  useEffect(() => {
    if (frameworks.length === 0) return;
    const resolved = resolveFrameworkFromParam(frameworkParam, frameworks);
    setSelectedFramework((prev) => (prev === resolved ? prev : resolved));
    const canonical = frameworkToParamValue(resolved, frameworks);
    if (canonical !== frameworkParam) {
      const params = new URLSearchParams(searchParams.toString());
      if (canonical === null) {
        params.delete("framework");
      } else {
        params.set("framework", canonical);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    }
  }, [frameworkParam, frameworks, pathname, router, searchParams]);

  useEffect(() => {
    if (!controlCatalogReady) {
      return;
    }
    void loadGapsData();
  }, [controlCatalogReady, loadGapsData]);

  const handleEvidenceProcessed = () => {
    loadGapsData();
    setUploadDialogOpen(false);
    setSelectedArtifactName("");
    setUploadDefaults({});
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFramework]);

  const getPaginatedArtifacts = (artifacts: ArtifactRecommendation[]) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return artifacts.slice(startIndex, endIndex);
  };

  const getTotalPages = (totalItems: number) => {
    return Math.ceil(totalItems / itemsPerPage);
  };

  const getGapTypeInfo = (gapType: string) => {
    switch (gapType) {
      case "no_evidence":
        return {
          label: "No Evidence",
          color: "bg-red-100 text-red-800 border-red-200",
          icon: <FileX className="h-4 w-4" />,
          priority: "High",
        };
      case "failed_assessment":
        return {
          label: "Failed Assessment",
          color: "bg-red-100 text-red-800 border-red-200",
          icon: <XCircle className="h-4 w-4" />,
          priority: "High",
        };
      case "partial_compliance":
        return {
          label: "Partial Compliance",
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          icon: <AlertTriangle className="h-4 w-4" />,
          priority: "Medium",
        };
      case "conflicting_evidence":
        return {
          label: "Conflicting Evidence",
          color: "bg-orange-100 text-orange-800 border-orange-200",
          icon: <AlertTriangle className="h-4 w-4" />,
          priority: "High",
        };
      case "no_assessment":
        return {
          label: "Needs Assessment",
          color: "bg-slate-100 text-slate-800 border-slate-200",
          icon: <Clock className="h-4 w-4" />,
          priority: "Medium",
        };
      case "compliant":
        return {
          label: "Compliant",
          color: "bg-green-100 text-green-800 border-green-200",
          icon: <CheckCircle className="h-4 w-4" />,
          priority: "None",
        };
      default:
        return {
          label: "Unknown",
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: <Clock className="h-4 w-4" />,
          priority: "Unknown",
        };
    }
  };

  if (evidenceCount !== null && isNewUser({ evidenceCount })) {
    return (
      <div className="space-y-6">
        <FirstRunHero
          onUploadClick={() => {
            setUploadDialogOpen(true);
          }}
        />
        <SmartEvidenceUpload
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          hideTrigger
          dialogTitle="Upload Your First Evidence Document"
          onEvidenceProcessed={handleEvidenceProcessed}
          defaultDocumentationArtifact={uploadDefaults.artifact}
          defaultDescription={uploadDefaults.description}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-ft-pink border-b-2"></div>
            <p className="mt-2 text-gray-600 text-sm">Loading compliance gaps...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !gapsData) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
            <p className="text-red-600">{error || "Failed to load compliance gaps"}</p>
            <Button onClick={loadGapsData} variant="outline" className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { overall_stats, top_gaps, gap_summary, artifact_recommendations } = gapsData;

  const isFrameworkFiltered =
    selectedFramework !== "all" && Boolean(gapsData.framework_filter?.filtered);

  const featuredFrameworks = FEATURED_FRAMEWORK_PATTERNS.map(({ displayLabel, test }) => {
    const match = frameworks
      .filter((fw) => test.test(fw.framework_name))
      .sort((a, b) => b.total_mappings - a.total_mappings)[0];
    return match ? { ...match, displayLabel } : null;
  }).filter((fw): fw is Framework & { displayLabel: string } => fw !== null);
  const selectedFrameworkMeta = frameworks.find((framework) => framework.id === selectedFramework);
  const frameworkDisplayName = isFrameworkFiltered
    ? `${gapsData.framework_filter?.framework_name ?? selectedFrameworkMeta?.framework_name ?? "Selected framework"} ${
        gapsData.framework_filter?.framework_version?.trim() ??
        selectedFrameworkMeta?.framework_version?.trim() ??
        ""
      }`.trim()
    : "All SCF Controls";
  const actionableGaps = (top_gaps || []).filter((gap) => gap.gap_type !== "compliant");

  return (
    <div className="space-y-6">
      <Card
        data-testid="dashboard-overview-card"
        className={cn("border-slate-200", isFrameworkFiltered && "border-slate-200 bg-ft-cream/50")}
      >
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <Badge
                data-testid="dashboard-coverage-mode-badge"
                variant="outline"
                className={cn(
                  "w-fit uppercase tracking-wide",
                  isFrameworkFiltered
                    ? "border-ft-pink bg-ft-cream text-ft-black"
                    : "border-slate-200 text-slate-600"
                )}
              >
                {isFrameworkFiltered ? "Framework focus mode" : "SCF coverage"}
              </Badge>
              <CardTitle className="flex items-center gap-2" data-testid="dashboard-overview-title">
                <Target className={cn("h-5 w-5", isFrameworkFiltered && "text-ft-pink")} />
                {isFrameworkFiltered ? `${frameworkDisplayName} Focus` : "Compliance Overview"}
              </CardTitle>
              {isFrameworkFiltered && (
                <CardDescription>
                  {`Showing the SCF controls mapped to ${frameworkDisplayName}.`}
                </CardDescription>
              )}
            </div>
            <div className="flex w-full flex-col gap-2 sm:max-w-sm sm:flex-row sm:items-center sm:justify-end">
              <div className="w-full">
                <Select value={selectedFramework} onValueChange={changeFramework}>
                  <SelectTrigger className="w-full" data-testid="framework-filter-trigger">
                    <SelectValue placeholder="Filter by framework" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All SCF Controls</SelectItem>
                    {frameworks.map((framework) => (
                      <SelectItem key={framework.id} value={framework.id}>
                        {framework.framework_name}
                        {framework.framework_version?.trim()
                          ? ` ${framework.framework_version.trim()}`
                          : ""}{" "}
                        ({framework.total_mappings} mappings)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isFrameworkFiltered && (
                <Button
                  data-testid="clear-framework-focus-button"
                  variant="ghost"
                  size="sm"
                  onClick={() => changeFramework("all")}
                  className="justify-start sm:justify-center"
                >
                  Clear focus
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isFrameworkFiltered && (
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <h3 className="ft-serif text-sm font-semibold text-ft-black">
                  Focused SCF control roadmap
                </h3>
                <p className="text-sm text-slate-600">
                  Work through the prioritized controls and recommended evidence to close this
                  framework efficiently.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  data-testid="dashboard-upload-evidence-button"
                  className=""
                  onClick={() => {
                    setUploadDefaults({
                      description: `Evidence for ${frameworkDisplayName}`,
                    });
                    setSelectedArtifactName(frameworkDisplayName);
                    setUploadDialogOpen(true);
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Evidence
                </Button>
                <Button
                  data-testid="view-priority-controls-button"
                  variant="outline"
                  className="border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    const prioritySection = document.getElementById("framework-priority-controls");
                    prioritySection?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Target className="mr-2 h-4 w-4" />
                  View Priority Controls
                </Button>
              </div>
            </div>
          )}

          {!isFrameworkFiltered && featuredFrameworks.length > 0 && (
            <div
              className="rounded-xl border border-slate-200 bg-ft-cream/50 p-5 shadow-sm"
              data-testid="framework-chip-picker"
            >
              <div className="space-y-1">
                <h3 className="ft-serif font-semibold text-ft-black text-sm">
                  Focus on the framework you actually need to satisfy
                </h3>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {featuredFrameworks.map((fw) => (
                  <Button
                    key={fw.id}
                    variant="outline"
                    size="sm"
                    data-testid={`framework-chip-${fw.id}`}
                    onClick={() => changeFramework(fw.id)}
                    className="border-slate-200 bg-white text-slate-800 hover:bg-ft-cream hover:text-ft-black"
                    title={`${fw.framework_name}${
                      fw.framework_version ? ` ${fw.framework_version}` : ""
                    } — ${fw.total_mappings.toLocaleString()} mappings`}
                  >
                    <span className="font-medium">{fw.displayLabel}</span>
                    <span className="ft-mono ml-2 text-slate-500 text-xs">
                      {fw.total_mappings.toLocaleString()}
                    </span>
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="framework-chip-all"
                  onClick={() => {
                    const trigger = document.querySelector<HTMLButtonElement>(
                      '[data-testid="framework-filter-trigger"]'
                    );
                    trigger?.scrollIntoView({ behavior: "smooth", block: "center" });
                    trigger?.click();
                  }}
                  className="text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                >
                  All {frameworks.length} frameworks ↓
                </Button>
              </div>
            </div>
          )}

          <div
            className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm"
            data-testid="coverage-summary-card"
          >
            <div className="ft-serif font-bold text-3xl text-ft-black">
              {overall_stats.passed_assessments}/{overall_stats.total_controls}
            </div>
            <p className="mt-1 text-gray-600 text-sm">Controls Covered</p>
            <Progress value={overall_stats.coverage_percentage} className="mt-3" />
            <p className="mt-2 text-gray-500 text-xs">
              {formatCoveragePercent(overall_stats.coverage_percentage)} Coverage
            </p>
          </div>
        </CardContent>
      </Card>

      {isFrameworkFiltered && actionableGaps.length > 0 && (
        <Card id="framework-priority-controls" className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="ft-serif flex items-center gap-2 text-ft-black">
              <Target className="h-5 w-5" />
              {frameworkDisplayName} Priority Controls
            </CardTitle>
            <CardDescription className="text-slate-600">
              We’ve surfaced the highest-impact SCF controls mapped to this framework. Close these
              gaps first to unlock the biggest compliance gains.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {actionableGaps.slice(0, 8).map((gap) => {
              const matchedArtifact = artifact_recommendations?.artifacts.find((artifact) =>
                artifact.control_details.some((control) => control.control_id === gap.control_id)
              );

              return (
                <EnhancedControlCardContainer
                  key={gap.control_id}
                  controlId={gap.control_id}
                  controlTitle={gap.control_title}
                  domainId={gap.domain_id}
                  hasEvidence={gap.has_evidence}
                  hasAssessment={gap.has_assessment}
                  assessmentResult={gap.assessment_result}
                  lastUpdated={gap.last_updated}
                  gapType={gap.gap_type}
                  onUploadEvidence={() => {
                    setUploadDefaults({
                      artifact: matchedArtifact?.artifact_name ?? gap.control_title,
                      description: `Evidence for ${gap.control_id} • ${gap.control_title}`,
                    });
                    setSelectedArtifactName(`${gap.control_id} • ${gap.control_title}`);
                    setUploadDialogOpen(true);
                  }}
                />
              );
            })}

            {actionableGaps.length > 8 && (
              <p className="text-xs text-slate-600">
                Showing the top 8 controls. Switch back to “All SCF Controls” to explore the full
                library or adjust your framework selection for a different roadmap.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="mr-2 h-5 w-5" />
            Coverage Breakdown
          </CardTitle>
          <CardDescription>
            Where your {overall_stats.total_controls} controls stand right now
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="flex items-center space-x-3 rounded-lg bg-green-50 p-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <div className="font-bold text-2xl text-green-600">{gap_summary.fully_covered}</div>
                <div className="text-gray-600 text-sm">Fully Covered</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 rounded-lg bg-yellow-50 p-3">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div>
                <div className="font-bold text-2xl text-yellow-600">
                  {gap_summary.partially_covered}
                </div>
                <div className="text-gray-600 text-sm">Partially Covered</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 rounded-lg bg-slate-50 p-3">
              <FileX className="h-8 w-8 text-slate-500" />
              <div>
                <div className="font-bold text-2xl text-slate-700">{gap_summary.no_evidence}</div>
                <div className="text-gray-600 text-sm">No Evidence</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 rounded-lg bg-orange-50 p-3">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div>
                <div className="font-bold text-2xl text-orange-600">
                  {gap_summary.conflicting_evidence}
                </div>
                <div className="text-gray-600 text-sm">Conflicting</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedFramework !== "all" &&
        (gapsData?.artifact_recommendations ? (
          artifact_recommendations && artifact_recommendations.artifacts.length > 0 ? (
            <Card className="border-slate-200 bg-ft-cream/40">
              <CardHeader>
                <CardTitle className="ft-serif flex items-center text-ft-black">
                  <BookOpen className="mr-2 h-5 w-5" />
                  Evidence Artifacts Needed for {frameworkDisplayName} Compliance
                </CardTitle>
                <CardDescription className="text-slate-600">
                  Upload these documentation artifacts to improve your {frameworkDisplayName}{" "}
                  compliance coverage. Artifacts are prioritized by impact and number of controls
                  they address.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 rounded-lg bg-ft-cream p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-800">
                      <strong>{artifact_recommendations.total_gap_controls}</strong> controls need
                      attention
                    </span>
                    <span className="text-ft-pink">
                      <strong>{artifact_recommendations.total_recommendations}</strong> artifacts
                      recommended
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {getPaginatedArtifacts(artifact_recommendations.artifacts).map(
                    (artifact, index) => (
                      <div
                        key={artifact.erl_id}
                        className="flex items-start space-x-4 rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm"
                      >
                        <div className="flex-shrink-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ft-pink font-medium text-sm text-white">
                            {index + 1}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="mb-1 font-medium text-gray-900">
                                {artifact.artifact_name}
                              </h4>
                              <p className="mb-2 line-clamp-2 text-gray-600 text-sm">
                                {artifact.artifact_description ||
                                  "Documentation artifact for compliance evidence"}
                              </p>

                              <div className="mb-2 flex items-center space-x-4 text-gray-500 text-xs">
                                <span className="flex items-center">
                                  <Target className="mr-1 h-3 w-3" />
                                  {artifact.covered_controls_count} control
                                  {artifact.covered_controls_count !== 1 ? "s" : ""}
                                </span>
                                <span className="flex items-center">
                                  <BarChart3 className="mr-1 h-3 w-3" />
                                  Impact: {artifact.impact_score}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {artifact.erl_id}
                                </Badge>
                              </div>

                              <div className="flex flex-wrap gap-1">
                                {artifact.control_details.slice(0, 4).map((control) => {
                                  const gapInfo = getGapTypeInfo(control.gap_type);
                                  return (
                                    <Badge
                                      key={control.control_id}
                                      className={`text-xs ${gapInfo.color}`}
                                      title={`${control.control_id}: ${control.control_title}`}
                                    >
                                      {control.control_id}
                                    </Badge>
                                  );
                                })}
                                {artifact.control_details.length > 4 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{artifact.control_details.length - 4} more
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="ml-4 flex-shrink-0">
                              <Button
                                size="sm"
                                className=""
                                onClick={() => {
                                  setUploadDefaults({
                                    artifact: artifact.artifact_name,
                                    description: `Evidence for ${artifact.artifact_name} (${frameworkDisplayName})`,
                                  });
                                  setSelectedArtifactName(artifact.artifact_name);
                                  setUploadDialogOpen(true);
                                }}
                              >
                                <Upload className="mr-1 h-3 w-3" />
                                Upload
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  {artifact_recommendations.artifacts.length > itemsPerPage && (
                    <div className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                          {Math.min(
                            currentPage * itemsPerPage,
                            artifact_recommendations.artifacts.length
                          )}{" "}
                          of {artifact_recommendations.artifacts.length} artifacts
                        </div>
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (currentPage > 1) setCurrentPage(currentPage - 1);
                                }}
                                className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                              />
                            </PaginationItem>

                            {Array.from(
                              {
                                length: getTotalPages(artifact_recommendations.artifacts.length),
                              },
                              (_, i) => i + 1
                            ).map((page) => {
                              const totalPages = getTotalPages(
                                artifact_recommendations.artifacts.length
                              );

                              if (
                                page === 1 ||
                                page === totalPages ||
                                (page >= currentPage - 1 && page <= currentPage + 1)
                              ) {
                                return (
                                  <PaginationItem key={page}>
                                    <PaginationLink
                                      href="#"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setCurrentPage(page);
                                      }}
                                      isActive={currentPage === page}
                                    >
                                      {page}
                                    </PaginationLink>
                                  </PaginationItem>
                                );
                              }

                              if (
                                (page === currentPage - 2 && currentPage > 3) ||
                                (page === currentPage + 2 && currentPage < totalPages - 2)
                              ) {
                                return (
                                  <PaginationItem key={page}>
                                    <PaginationEllipsis />
                                  </PaginationItem>
                                );
                              }

                              return null;
                            })}

                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (
                                    currentPage <
                                    getTotalPages(artifact_recommendations.artifacts.length)
                                  ) {
                                    setCurrentPage(currentPage + 1);
                                  }
                                }}
                                className={
                                  currentPage >=
                                  getTotalPages(artifact_recommendations.artifacts.length)
                                    ? "pointer-events-none opacity-50"
                                    : ""
                                }
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-slate-700 text-sm">
                    💡 <strong>Pro Tip:</strong> Upload artifacts in priority order to maximize your{" "}
                    {frameworkDisplayName} compliance improvement. Each artifact addresses multiple
                    controls and gaps.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center text-gray-700">
                  <BookOpen className="mr-2 h-5 w-5" />
                  Evidence Artifacts for {frameworkDisplayName}
                </CardTitle>
                <CardDescription>
                  No artifact recommendations available for this framework selection.
                </CardDescription>
              </CardHeader>
            </Card>
          )
        ) : (
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center text-gray-700">
                <BookOpen className="mr-2 h-5 w-5" />
                Loading Evidence Artifacts...
              </CardTitle>
              <CardDescription>
                Analyzing framework requirements to recommend documentation artifacts.
              </CardDescription>
            </CardHeader>
          </Card>
        ))}

      {/* Compliance Inbox summary — top 3 action items */}
      <InboxSummary />

      {/* AI-powered gap remediation with guidance */}
      {selectedFramework !== "all" && actionableGaps.length > 0 && (
        <GapRemediationPanel
          frameworkId={selectedFramework}
          frameworkName={selectedFrameworkMeta?.framework_name}
          onStartUpload={(artifactName, controlIds) => {
            setUploadDefaults({
              artifact: artifactName,
              description: `Evidence for ${artifactName} (${controlIds.length} controls)`,
            });
            setSelectedArtifactName(artifactName);
            setUploadDialogOpen(true);
          }}
        />
      )}

      <SmartEvidenceUpload
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) {
            setUploadDefaults({});
            setSelectedArtifactName("");
          }
        }}
        hideTrigger
        dialogTitle={
          selectedArtifactName ? `Upload Evidence for ${selectedArtifactName}` : "Upload Evidence"
        }
        onEvidenceProcessed={handleEvidenceProcessed}
        defaultDocumentationArtifact={uploadDefaults.artifact}
        defaultDescription={uploadDefaults.description}
      />
    </div>
  );
}

function InboxSummary() {
  const [items, setItems] = useState<
    Array<{
      id: string;
      type: string;
      priority: string;
      title: string;
      description: string;
      actionLabel: string;
      actionUrl: string;
    }>
  >([]);

  useEffect(() => {
    fetch("/api/compliance/inbox", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.inbox?.items) {
          setItems(data.inbox.items.slice(0, 3));
        }
      })
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  const priorityBorder: Record<string, string> = {
    critical: "border-l-red-500",
    high: "border-l-amber-500",
    medium: "border-l-slate-400",
    low: "border-l-slate-300",
  };

  return (
    <Card className="ft-card" data-testid="inbox-summary-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="ft-serif font-bold text-lg text-ft-black">
            <Inbox className="mr-2 inline-block h-4 w-4" />
            Compliance Inbox
          </CardTitle>
          <Link
            href="/dashboard/compliance-inbox"
            className="font-medium text-ft-black text-sm underline decoration-slate-300 hover:text-ft-pink"
          >
            View all →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded border border-l-4 bg-white p-3 ${priorityBorder[item.priority] || "border-l-slate-300"}`}
          >
            <div className="font-medium text-slate-900 text-sm">{item.title}</div>
            <div className="mt-0.5 text-slate-500 text-xs">
              {item.description.slice(0, 100)}
              {item.description.length > 100 ? "..." : ""}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function DashboardOverview() {
  return (
    <>
      <RedirectHandler />

      <DashboardLayout
        title="Compliance Dashboard"
        description="At-a-glance compliance status, current gaps, and next actions to take right now."
        showStatsCards={false}
        showUploadButton={true}
      >
        <ComplianceGaps />
      </DashboardLayout>
    </>
  );
}
