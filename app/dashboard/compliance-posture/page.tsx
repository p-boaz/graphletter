"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Download,
  Minus,
  RefreshCw,
  Shield,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard-layout";
import { EmptyTabState } from "@/components/dashboard/empty-tab-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { isNewUser } from "@/lib/dashboard/is-new-user";
import { useEvidenceCount } from "@/lib/dashboard/use-evidence-count";

interface DomainPosture {
  domainId: string;
  domainName: string;
  tier: "critical" | "high" | "standard";
  weight: number;
  totalControls: number;
  compliantControls: number;
  partialControls: number;
  missingControls: number;
  conflictingControls: number;
  rawScore: number;
  weightedScore: number;
}

interface PostureScore {
  overallScore: number;
  totalControls: number;
  compliantControls: number;
  partialControls: number;
  missingControls: number;
  conflictingControls: number;
  domains: DomainPosture[];
  frameworkId: string | null;
  calculatedAt: string;
  weightFallback: boolean;
}

interface HistoryPoint {
  score: number;
  createdAt: string;
  totalControls: number;
  compliantControls: number;
}

const TIER_COLORS = {
  critical: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    badge: "bg-red-100 text-red-800",
    bar: "bg-red-500",
  },
  high: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    bar: "bg-amber-500",
  },
  standard: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    badge: "bg-slate-100 text-slate-800",
    bar: "bg-slate-400",
  },
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-700";
  if (score >= 60) return "text-amber-700";
  return "text-red-700";
}

function scoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-50 border-green-200";
  if (score >= 60) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

function TrendArrow({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return <Minus className="h-4 w-4 text-slate-400" />;
  if (diff > 0)
    return (
      <span className="flex items-center gap-1 text-green-600 text-sm">
        <ArrowUp className="h-4 w-4" />+{diff.toFixed(1)}%
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-red-600 text-sm">
      <ArrowDown className="h-4 w-4" />
      {diff.toFixed(1)}%
    </span>
  );
}

function TrendTimeline({ history }: { history: HistoryPoint[] }) {
  if (history.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-500 text-sm">
        Need at least 2 snapshots for trend data. Scores are captured after each assessment.
      </div>
    );
  }

  const maxScore = Math.max(...history.map((h) => h.score), 100);
  const minScore = Math.min(...history.map((h) => h.score), 0);
  const range = maxScore - minScore || 1;

  return (
    <div className="space-y-2">
      <div className="relative h-40 w-full">
        <svg
          viewBox={`0 0 ${history.length * 60} 160`}
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = 150 - ((pct - minScore) / range) * 140;
            return (
              <line
                key={pct}
                x1="0"
                y1={y}
                x2={history.length * 60}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
            );
          })}
          {/* Line */}
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            points={history
              .map((h, i) => {
                const x = i * 60 + 30;
                const y = 150 - ((h.score - minScore) / range) * 140;
                return `${x},${y}`;
              })
              .join(" ")}
          />
          {/* Dots */}
          {history.map((h, i) => {
            const x = i * 60 + 30;
            const y = 150 - ((h.score - minScore) / range) * 140;
            return (
              <circle key={i} cx={x} cy={y} r="4" fill="#3b82f6" stroke="white" strokeWidth="2">
                <title>
                  {new Date(h.createdAt).toLocaleDateString()}: {h.score.toFixed(1)}%
                </title>
              </circle>
            );
          })}
        </svg>
      </div>
      <div className="flex justify-between px-2 text-slate-500 text-xs">
        <span>{new Date(history[0].createdAt).toLocaleDateString()}</span>
        <span>{new Date(history[history.length - 1].createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

export default function CompliancePosturePage() {
  const [posture, setPosture] = useState<PostureScore | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const evidenceCount = useEvidenceCount();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [postureRes, historyRes] = await Promise.all([
        fetch("/api/compliance/posture", { cache: "no-store" }),
        fetch("/api/compliance/posture/history", { cache: "no-store" }),
      ]);

      if (postureRes.ok) {
        const data = await postureRes.json();
        setPosture(data.posture || null);
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.history || []);
      }
    } catch (loadError) {
      setError("Unable to load compliance posture data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleExport = async (format: "csv" | "json") => {
    setExporting(true);
    try {
      const response = await fetch(`/api/reports/compliance?format=${format}`);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-report-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Compliance report exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Failed to export compliance report");
    } finally {
      setExporting(false);
    }
  };

  if (evidenceCount !== null && isNewUser({ evidenceCount })) {
    return (
      <DashboardLayout
        title="Compliance Posture"
        description="Risk-weighted compliance scoring across all SCF domains."
        showUploadButton={true}
      >
        <EmptyTabState
          title="No posture score yet"
          body="Your risk-weighted compliance posture comes alive after you upload your first evidence document — we need data to score against."
          cta={{ label: "Upload evidence", href: "/dashboard?upload=1" }}
        />
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout
        title="Compliance Posture"
        description="Risk-weighted compliance scoring across all SCF domains."
        showUploadButton={true}
      >
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
              <p className="mt-2 text-gray-600 text-sm">Calculating compliance posture...</p>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout
        title="Compliance Posture"
        description="Risk-weighted compliance scoring across all SCF domains."
        showUploadButton={true}
      >
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
              <p className="text-red-600">{error}</p>
              <Button onClick={loadData} variant="outline" className="mt-2">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (!posture) {
    return (
      <DashboardLayout
        title="Compliance Posture"
        description="Risk-weighted compliance scoring across all SCF domains."
        showUploadButton={true}
      >
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-slate-600">
              <Shield className="mx-auto mb-3 h-12 w-12 text-slate-400" />
              <p className="font-medium text-lg">No posture data yet</p>
              <p className="mt-1 text-sm">
                Run a gap analysis to generate your compliance posture score.
              </p>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const previousScore = history.length >= 2 ? history[history.length - 2].score : null;

  return (
    <DashboardLayout
      title="Compliance Posture"
      description="Risk-weighted compliance scoring across all SCF domains."
      showUploadButton={true}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="border-slate-300">
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={exporting}
            className="border-slate-300"
          >
            <Download className="mr-1 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Overall Score Card */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card
            className={`border ${scoreBgColor(posture.overallScore)}`}
            data-testid="posture-overall-score"
          >
            <CardContent className="p-6 text-center">
              <div className={`font-bold text-4xl ${scoreColor(posture.overallScore)}`}>
                {posture.overallScore.toFixed(1)}%
              </div>
              <div className="mt-1 text-slate-600 text-sm">Overall Posture Score</div>
              {previousScore !== null && (
                <div className="mt-2">
                  <TrendArrow current={posture.overallScore} previous={previousScore} />
                </div>
              )}
              {posture.weightFallback && (
                <div className="mt-2 text-amber-600 text-xs">
                  Using equal weights (tier data unavailable)
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-green-200 bg-green-50">
            <CardContent className="p-6 text-center">
              <div className="font-bold text-3xl text-green-700">{posture.compliantControls}</div>
              <div className="text-green-600 text-sm">Compliant</div>
              <div className="mt-1 text-green-500 text-xs">of {posture.totalControls} total</div>
            </CardContent>
          </Card>

          <Card className="border border-amber-200 bg-amber-50">
            <CardContent className="p-6 text-center">
              <div className="font-bold text-3xl text-amber-700">{posture.partialControls}</div>
              <div className="text-amber-600 text-sm">Partial</div>
              <div className="mt-1 text-amber-500 text-xs">Need stronger evidence</div>
            </CardContent>
          </Card>

          <Card className="border border-red-200 bg-red-50">
            <CardContent className="p-6 text-center">
              <div className="font-bold text-3xl text-red-700">{posture.missingControls}</div>
              <div className="text-red-600 text-sm">Missing</div>
              <div className="mt-1 text-red-500 text-xs">
                {posture.conflictingControls > 0
                  ? `+ ${posture.conflictingControls} conflicting`
                  : "No evidence"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trend Timeline */}
        <Card className="ft-card" data-testid="posture-trend-chart">
          <CardHeader>
            <CardTitle className="ft-serif font-bold text-2xl text-ft-black">
              <TrendingUp className="mr-2 inline-block h-5 w-5" />
              Posture Trend
            </CardTitle>
            <CardDescription className="ft-sans text-base text-slate-600">
              Score changes over time. Each point is a snapshot taken after assessments complete.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TrendTimeline history={history} />
          </CardContent>
        </Card>

        {/* Domain Breakdown */}
        <Card className="ft-card" data-testid="posture-domain-breakdown">
          <CardHeader>
            <CardTitle className="ft-serif font-bold text-2xl text-ft-black">
              Domain Breakdown
            </CardTitle>
            <CardDescription className="ft-sans text-base text-slate-600">
              Risk-weighted compliance by SCF domain. Critical domains (3x) impact the overall score
              more than standard domains (1x).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {posture.domains.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-600 text-sm">
                No domain data available.
              </div>
            ) : (
              <div className="space-y-3">
                {posture.domains.map((domain) => {
                  const colors = TIER_COLORS[domain.tier];
                  return (
                    <div
                      key={domain.domainId}
                      className={`rounded-lg border p-4 ${colors.bg} ${colors.border}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium text-xs ${colors.badge}`}
                          >
                            {domain.tier}
                            {domain.weight !== 1 && ` (${domain.weight}x)`}
                          </span>
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">
                              {domain.domainName}
                            </div>
                            <div className="font-mono text-slate-500 text-xs">
                              {domain.domainId}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold text-lg ${scoreColor(domain.rawScore)}`}>
                            {domain.rawScore.toFixed(1)}%
                          </div>
                          <div className="text-slate-500 text-xs">
                            {domain.compliantControls}/{domain.totalControls} compliant
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Progress value={domain.rawScore} className="h-2" />
                      </div>
                      {(domain.partialControls > 0 || domain.conflictingControls > 0) && (
                        <div className="mt-2 flex gap-3 text-xs">
                          {domain.partialControls > 0 && (
                            <span className="text-amber-600">{domain.partialControls} partial</span>
                          )}
                          {domain.missingControls > 0 && (
                            <span className="text-red-600">{domain.missingControls} missing</span>
                          )}
                          {domain.conflictingControls > 0 && (
                            <span className="text-orange-600">
                              {domain.conflictingControls} conflicting
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calculated At + Metadata */}
        <div className="rounded bg-slate-50 p-3 text-slate-500 text-xs">
          Score calculated at {new Date(posture.calculatedAt).toLocaleString()}.{" "}
          {posture.weightFallback
            ? "Using equal domain weights (tier data unavailable)."
            : `Using risk-weighted domain tiers (${posture.domains.filter((d) => d.tier === "critical").length} critical, ${posture.domains.filter((d) => d.tier === "high").length} high, ${posture.domains.filter((d) => d.tier === "standard").length} standard).`}
        </div>
      </div>
    </DashboardLayout>
  );
}
