"use client";

import {
  ArrowLeft,
  BookOpen,
  Database,
  ExternalLink,
  Loader2,
  Search,
  Shield,
  Target,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { EnhancedControlCard } from "@/components/enhanced-control-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface SCFFramework {
  id: string;
  framework_name: string;
  framework_version: string;
  total_mappings: number;
}

interface SCFControlMapping {
  id: string;
  framework_control_id: string;
  mapping_type: string;
  confidence_score: number | null;
  scf_frameworks?: {
    id?: string;
    framework_name: string;
    framework_version: string;
    total_mappings?: number;
  } | null;
}

interface SCFControl {
  id: string;
  title: string;
  description: string;
  domain_id: string;
  scf_control_mappings?: SCFControlMapping[];
}

interface Risk {
  id: string;
  title: string;
  description: string;
  risk_grouping: string;
  nist_csf_function: string;
}

interface Threat {
  id: string;
  title: string;
  description: string;
  threat_grouping: string;
}

interface MaturityLevels {
  scf_control_id: string;
  level_0_description: string | null;
  level_1_description: string | null;
  level_2_description: string | null;
  level_3_description: string | null;
  level_4_description: string | null;
  level_5_description: string | null;
}

interface ControlDetail extends SCFControl {
  control_questions?: string[] | null;
  scf_control_mappings: SCFControlMapping[];
  risks: Risk[];
  threats: Threat[];
  maturity_levels: MaturityLevels | null;
}

interface ExplorerStats {
  totalControls: number;
  totalFrameworks: number;
  totalMappings: number;
  controls: number;
  frameworks: number;
  mappings: number;
}

interface MappingExplorerContentProps {
  embedded?: boolean;
  initialRenderCount?: number;
}

const DEFAULT_INITIAL_RENDER_COUNT = 50;

function MappingExplorerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-20" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-[28rem] lg:col-span-2" />
        <Skeleton className="h-[28rem]" />
      </div>
    </div>
  );
}

function MappingExplorerContent({
  embedded = false,
  initialRenderCount = DEFAULT_INITIAL_RENDER_COUNT,
}: MappingExplorerContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [frameworks, setFrameworks] = useState<SCFFramework[]>([]);
  const [allControls, setAllControls] = useState<SCFControl[]>([]);
  const [controls, setControls] = useState<SCFControl[]>([]);
  const [stats, setStats] = useState<ExplorerStats>({
    totalControls: 0,
    totalFrameworks: 0,
    totalMappings: 0,
    controls: 0,
    frameworks: 0,
    mappings: 0,
  });
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [selectedDomain, setSelectedDomain] = useState(searchParams.get("domain") || "all");
  const [selectedFramework, setSelectedFramework] = useState(
    searchParams.get("framework") || "all"
  );
  const [loading, setLoading] = useState(true);
  const [loadingControls, setLoadingControls] = useState(false);
  const [visibleControlCount, setVisibleControlCount] = useState(initialRenderCount);
  const [selectedControl, setSelectedControl] = useState<SCFControl | null>(null);
  const [selectedControlDetail, setSelectedControlDetail] = useState<ControlDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);

  const updateURL = (params: Record<string, string>) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());

    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== "all") {
        newSearchParams.set(key, value);
      } else {
        newSearchParams.delete(key);
      }
    });

    const queryString = newSearchParams.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  };

  const selectedFrameworkName = useMemo(() => {
    if (selectedFramework === "all") {
      return null;
    }
    const framework = frameworks.find((item) => item.id === selectedFramework);
    return framework?.framework_name.toLowerCase() ?? null;
  }, [frameworks, selectedFramework]);

  const filterControls = (controlsToFilter: SCFControl[]) => {
    let filtered = controlsToFilter;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (control) =>
          control.id.toLowerCase().includes(term) ||
          control.title.toLowerCase().includes(term) ||
          control.description.toLowerCase().includes(term)
      );
    }

    if (selectedDomain !== "all") {
      filtered = filtered.filter((control) => control.domain_id === selectedDomain);
    }

    if (selectedFrameworkName) {
      filtered = filtered.filter((control) =>
        (control.scf_control_mappings || []).some((mapping) => {
          const frameworkName = mapping.scf_frameworks?.framework_name?.toLowerCase();
          return frameworkName === selectedFrameworkName;
        })
      );
    }

    return filtered;
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);

        const [statsResponse, frameworksResponse] = await Promise.all([
          fetch("/api/scf/stats"),
          fetch("/api/scf/frameworks"),
        ]);

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats({
            totalControls: statsData.controls || statsData.totalControls || 0,
            totalFrameworks: statsData.frameworks || statsData.totalFrameworks || 0,
            totalMappings: statsData.mappings || statsData.totalMappings || 0,
            controls: statsData.controls || 0,
            frameworks: statsData.frameworks || 0,
            mappings: statsData.mappings || 0,
          });
        }

        if (frameworksResponse.ok) {
          const frameworksData = await frameworksResponse.json();
          setFrameworks(Array.isArray(frameworksData) ? frameworksData : []);
        }

        setLoadingControls(true);
        const controlsResponse = await fetch("/api/scf/controls?limit=all");
        if (controlsResponse.ok) {
          const controlsData = await controlsResponse.json();
          const rawControls = Array.isArray(controlsData)
            ? controlsData
            : controlsData.controls || [];

          setAllControls(rawControls);
          setControls(filterControls(rawControls));
          setStats((prev) => ({
            ...prev,
            totalControls: rawControls.length,
            controls: rawControls.length,
          }));
        }
      } catch (error) {
        console.error("Error loading mapping explorer data", error);
        setAllControls([]);
        setControls([]);
      } finally {
        setLoading(false);
        setLoadingControls(false);
      }
    };

    void loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setControls(filterControls(allControls));
    setVisibleControlCount(initialRenderCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allControls, searchTerm, selectedDomain, selectedFrameworkName, initialRenderCount]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    updateURL({
      search: value,
      domain: selectedDomain,
      framework: selectedFramework,
    });
  };

  const handleDomainChange = (value: string) => {
    setSelectedDomain(value);
    updateURL({
      search: searchTerm,
      domain: value,
      framework: selectedFramework,
    });
  };

  const handleFrameworkChange = (value: string) => {
    setSelectedFramework(value);
    updateURL({ search: searchTerm, domain: selectedDomain, framework: value });
  };

  const loadControlDetails = async (control: SCFControl) => {
    setSelectedControl(control);
    setSelectedControlDetail(null);
    setDetailLoading(true);

    try {
      const response = await fetch(`/api/scf/controls/${control.id}`);
      if (response.ok) {
        const data = await response.json();
        const detail: ControlDetail = {
          ...control,
          ...data,
          scf_control_mappings: data.scf_control_mappings || [],
          risks: data.risks || [],
          threats: data.threats || [],
          maturity_levels: data.maturity_levels || null,
        };
        setSelectedControlDetail(detail);
      }
    } catch (error) {
      console.error("Error loading control details", error);
      setSelectedControlDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openControlDetail = (control: SCFControl) => {
    void loadControlDetails(control);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    detailPanelRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const domains = useMemo(
    () => Array.from(new Set(allControls.map((control) => control.domain_id))).sort(),
    [allControls]
  );

  const safeToLocaleString = (value: number | undefined | null) => {
    return (value || 0).toLocaleString();
  };
  const renderedControls = controls.slice(0, visibleControlCount);
  const hasMoreControls = visibleControlCount < controls.length;

  const derivedHasEvidence = Boolean(
    selectedControlDetail?.scf_control_mappings &&
      selectedControlDetail.scf_control_mappings.length > 0
  );
  const derivedHasAssessment = Boolean(
    selectedControlDetail?.control_questions && selectedControlDetail.control_questions.length > 0
  );
  const derivedGapType = (() => {
    if (!selectedControlDetail) {
      return "no_evidence" as const;
    }
    if (derivedHasEvidence && derivedHasAssessment) {
      return "compliant" as const;
    }
    if (derivedHasAssessment) {
      return "partial_compliance" as const;
    }
    return "no_evidence" as const;
  })();

  if (loading) {
    return <MappingExplorerSkeleton />;
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
            </div>
            <h2 className="ft-serif text-3xl font-bold text-slate-900">SCF Mapping Explorer</h2>
            <p className="ft-sans mt-1 text-slate-600">
              Explore {safeToLocaleString(allControls.length)} controls mapped across{" "}
              {stats.totalFrameworks} frameworks.
            </p>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            <Database className="mr-2 h-3 w-3" />
            {safeToLocaleString(stats.totalMappings)} mappings
          </Badge>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card
          className={
            embedded
              ? "border-slate-200 bg-white"
              : "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={embedded ? "ft-eyebrow text-slate-500" : "text-blue-100 text-sm"}>
                  Total Controls
                </p>
                <p
                  className={
                    embedded ? "text-2xl font-semibold text-slate-950" : "text-2xl font-semibold"
                  }
                >
                  {safeToLocaleString(allControls.length)}
                </p>
              </div>
              <Shield className={embedded ? "h-8 w-8 text-slate-300" : "h-8 w-8 text-blue-200"} />
            </div>
          </CardContent>
        </Card>
        <Card
          className={
            embedded
              ? "border-slate-200 bg-white"
              : "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={embedded ? "ft-eyebrow text-slate-500" : "text-emerald-100 text-sm"}>
                  Frameworks
                </p>
                <p
                  className={
                    embedded ? "text-2xl font-semibold text-slate-950" : "text-2xl font-semibold"
                  }
                >
                  {safeToLocaleString(stats.totalFrameworks)}
                </p>
              </div>
              <BookOpen
                className={embedded ? "h-8 w-8 text-slate-300" : "h-8 w-8 text-emerald-200"}
              />
            </div>
          </CardContent>
        </Card>
        <Card
          className={
            embedded
              ? "border-slate-200 bg-white"
              : "bg-gradient-to-r from-purple-500 to-purple-600 text-white"
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={embedded ? "ft-eyebrow text-slate-500" : "text-purple-100 text-sm"}>
                  Cross-Mappings
                </p>
                <p
                  className={
                    embedded ? "text-2xl font-semibold text-slate-950" : "text-2xl font-semibold"
                  }
                >
                  {safeToLocaleString(stats.totalMappings)}
                </p>
              </div>
              <Target className={embedded ? "h-8 w-8 text-slate-300" : "h-8 w-8 text-purple-200"} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white/80 backdrop-blur-sm">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="Search controls by ID, title, or description..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select value={selectedDomain} onValueChange={handleDomainChange}>
                <SelectTrigger className="w-full min-w-[12rem] sm:w-48">
                  <SelectValue placeholder="Filter by domain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Domains</SelectItem>
                  {domains.map((domain) => (
                    <SelectItem key={domain} value={domain}>
                      {domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedFramework} onValueChange={handleFrameworkChange}>
                <SelectTrigger className="w-full min-w-[12rem] sm:w-48">
                  <SelectValue placeholder="Filter by framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frameworks</SelectItem>
                  {frameworks.map((framework) => (
                    <SelectItem key={framework.id} value={framework.id}>
                      {framework.framework_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {loadingControls && (
            <div className="flex items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading control catalog...
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white/80 backdrop-blur-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              SCF Controls
              <Badge variant="secondary" className="ml-1">
                Showing {safeToLocaleString(Math.min(visibleControlCount, controls.length))} of{" "}
                {safeToLocaleString(controls.length)}
              </Badge>
              {allControls.length > 0 && (
                <Badge variant="outline" className="ml-1 text-xs">
                  {safeToLocaleString(allControls.length)} total
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Select a control to view mappings and related context.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[28rem] overflow-y-auto">
              {loadingControls ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  Loading controls...
                </div>
              ) : controls.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Shield className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                  No controls match the current filters.
                </div>
              ) : (
                <>
                  {renderedControls.map((control) => {
                    const isActive = selectedControl?.id === control.id;
                    return (
                      <div
                        key={control.id}
                        className={`border-b border-slate-100 p-4 transition-colors hover:bg-slate-50 ${
                          isActive ? "bg-blue-50/60" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            className="flex-1 text-left"
                            onClick={() => loadControlDetails(control)}
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                {control.id}
                              </Badge>
                              <Badge variant="outline" className="text-xs text-slate-600">
                                {control.domain_id}
                              </Badge>
                            </div>
                            <h4 className="font-medium text-slate-900">{control.title}</h4>
                            <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                              {control.description}
                            </p>
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openControlDetail(control)}
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only">Open control detail</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {hasMoreControls && (
                    <div className="border-t border-slate-100 p-4 text-center">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setVisibleControlCount((current) =>
                            Math.min(current + initialRenderCount, controls.length)
                          )
                        }
                      >
                        Load{" "}
                        {safeToLocaleString(
                          Math.min(initialRenderCount, controls.length - visibleControlCount)
                        )}{" "}
                        more
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div ref={detailPanelRef} className="scroll-mt-4 space-y-4">
          <Card className="border-slate-200 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Framework Mappings
              </CardTitle>
              <CardDescription>
                {selectedControl
                  ? `Mappings for ${selectedControl.id}`
                  : "Select a control to view mappings."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedControl ? (
                detailLoading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading mappings...
                  </div>
                ) : selectedControlDetail &&
                  selectedControlDetail.scf_control_mappings.length > 0 ? (
                  <div className="space-y-3">
                    {selectedControlDetail.scf_control_mappings.map((mapping) => (
                      <div key={mapping.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="font-mono text-xs">
                            {mapping.framework_control_id}
                          </Badge>
                          <Badge
                            variant={
                              (mapping.confidence_score || 0) >= 0.8 ? "default" : "secondary"
                            }
                            className="text-xs"
                          >
                            {Math.round((mapping.confidence_score || 0) * 100)}%
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-900">
                          {mapping.scf_frameworks?.framework_name || "Framework"}
                        </p>
                        <p className="text-xs text-slate-600 capitalize">
                          {mapping.mapping_type || "direct"} mapping
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-sm text-slate-500">
                    No mappings available for this control yet.
                  </p>
                )
              ) : (
                <div className="py-12 text-center text-sm text-slate-500">
                  Select a control to view mapping details.
                </div>
              )}
            </CardContent>
          </Card>

          {selectedControlDetail && (
            <EnhancedControlCard
              controlId={selectedControlDetail.id}
              controlTitle={selectedControlDetail.title}
              domainId={selectedControlDetail.domain_id}
              hasEvidence={derivedHasEvidence}
              hasAssessment={derivedHasAssessment}
              assessmentResult={null}
              lastUpdated={null}
              gapType={derivedGapType}
              risks={selectedControlDetail.risks}
              threats={selectedControlDetail.threats}
              maturityLevels={selectedControlDetail.maturity_levels}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function MappingExplorer(props: MappingExplorerContentProps) {
  return (
    <Suspense fallback={<MappingExplorerSkeleton />}>
      <MappingExplorerContent {...props} />
    </Suspense>
  );
}
