"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
  Info,
  Loader2,
  Search,
  Shield,
  Target,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AssessmentResultsDisplay } from "@/components/assessment-results-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assessmentHeadline, type ObjectiveStatus } from "@/lib/assessments/summary";
import { authUrl } from "@/lib/auth/auth-tabs";
import type { AssessmentResult } from "@/lib/client/smart-evidence-workflow";
import { DEMO_SAMPLES, type DemoSample } from "@/lib/demo/demo-registry";

function verdictBadgeClass(r: string): string {
  switch (r) {
    case "pass":
      return "border-green-300 bg-green-100 text-green-800";
    case "partial":
      return "border-yellow-300 bg-yellow-100 text-yellow-800";
    case "fail":
      return "border-red-300 bg-red-100 text-red-800";
    default:
      return "border-gray-300 bg-gray-100 text-gray-700";
  }
}

type DemoStep = "select" | "running" | "results" | "error";

interface DemoAssessmentResponse {
  success: boolean;
  sample: {
    id: string;
    label: string;
    artifactName: string;
    scfControlId: string;
  };
  assessment: AssessmentResult;
}

export function DemoSmartEvidenceUpload() {
  const [selectedSampleId, setSelectedSampleId] = useState<string>("");
  const [step, setStep] = useState<DemoStep>("select");
  const [progressPct, setProgressPct] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [result, setResult] = useState<DemoAssessmentResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [quota, setQuota] = useState<{ remaining: number; max: number } | null>(null);

  useEffect(() => {
    fetch("/api/try-it-out/demo/quota")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.remaining === "number" && typeof data.max === "number") {
          setQuota(data);
        }
      })
      .catch(() => {
        // Silently ignore — counter is a nice-to-have, not critical.
      });
  }, []);

  const selectedSample = DEMO_SAMPLES.find((s) => s.id === selectedSampleId);

  async function runDemo() {
    if (!selectedSample) return;

    setStep("running");
    setProgressPct(10);
    setProgressMsg("Uploading document...");

    const progressInterval = setInterval(() => {
      setProgressPct((prev) => {
        if (prev >= 85) return prev;
        const increment = prev < 30 ? 8 : prev < 60 ? 4 : 2;
        return prev + increment;
      });
    }, 2000);

    const stageTimers = [
      setTimeout(() => setProgressMsg("Reading and extracting text from document..."), 3000),
      setTimeout(() => setProgressMsg("Identifying which compliance requirements apply..."), 6000),
      setTimeout(
        () =>
          setProgressMsg(
            `Checking document against ${selectedSample.scfControlId} requirements...`
          ),
        10000
      ),
      setTimeout(
        () =>
          setProgressMsg("Evaluating each assessment objective — does the document address it?"),
        17000
      ),
      setTimeout(() => setProgressMsg("Scoring compliance maturity level..."), 25000),
    ];

    try {
      const response = await fetch("/api/try-it-out/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId: selectedSample.id }),
      });

      clearInterval(progressInterval);
      stageTimers.forEach(clearTimeout);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${response.status})`);
      }

      const data = (await response.json()) as DemoAssessmentResponse;
      setProgressPct(100);
      setProgressMsg("Assessment complete!");
      setResult(data);

      setTimeout(() => setStep("results"), 600);
    } catch (err) {
      clearInterval(progressInterval);
      stageTimers.forEach(clearTimeout);
      setErrorMsg(err instanceof Error ? err.message : "Demo assessment failed");
      setStep("error");
    }
  }

  function reset() {
    setStep("select");
    setSelectedSampleId("");
    setProgressPct(0);
    setProgressMsg("");
    setResult(null);
    setErrorMsg("");
  }

  // ── Step 1: Select ──────────────────────────────────────────────
  if (step === "select") {
    return (
      <div className="space-y-6">
        {/* Context: what problem does this solve? */}
        <div className="space-y-3 rounded-lg bg-ft-cream/60 p-5">
          <h3 className="ft-serif font-semibold text-ft-black">
            Does your documentation actually meet compliance requirements?
          </h3>
          <p className="text-slate-700 text-sm leading-relaxed">
            Organizations maintain policies, procedures, and other documents to satisfy security and
            privacy frameworks (NIST, ISO 27001, SOC 2, GDPR, etc.). But proving that a specific
            document actually addresses a specific control requirement usually means hours of manual
            review.
          </p>
          <p className="text-slate-700 text-sm leading-relaxed">
            <strong>Graphletter automates this.</strong> Upload a document, and AI reads it against
            the relevant compliance requirements — then tells you exactly what passes, what fails,
            and why.
          </p>
        </div>

        {/* The demo flow */}
        <div className="space-y-4 rounded-lg border border-slate-200 p-5">
          <div>
            <h4 className="font-semibold text-slate-900">Try it now with a sample document</h4>
            <p className="mt-1 text-slate-600 text-sm">
              We&apos;ve prepared sample compliance documents you can use. In the full product,
              you&apos;d upload your own files here.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="demo-sample">1. Pick a document to upload</Label>
            <Select value={selectedSampleId} onValueChange={setSelectedSampleId}>
              <SelectTrigger id="demo-sample" data-testid="demo-sample-select">
                <SelectValue placeholder="Choose a sample document..." />
              </SelectTrigger>
              <SelectContent>
                {DEMO_SAMPLES.map((sample) => (
                  <SelectItem key={sample.id} value={sample.id}>
                    {sample.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSample && <SamplePreview sample={selectedSample} />}

          <div>
            <Label className="mb-2 block">2. Upload and run AI assessment</Label>
            {quota && (
              <p
                className="mb-2 text-right text-[11px] text-slate-500"
                data-testid="demo-runs-remaining"
              >
                {quota.remaining} of {quota.max} runs remaining this hour
              </p>
            )}
            <Button
              onClick={runDemo}
              disabled={!selectedSample}
              data-testid="demo-run-button"
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Document & Assess Compliance
            </Button>
          </div>
        </div>

        {/* What happens when you click */}
        <div className="rounded-lg bg-gray-50 p-4">
          <h4 className="mb-3 font-medium text-gray-900 text-sm">What happens after you upload?</h4>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <StepIndicator
              icon={<Upload className="h-3.5 w-3.5" />}
              title="Document is uploaded"
              desc="AI reads and extracts the text content from your document"
            />
            <StepIndicator
              icon={<Search className="h-3.5 w-3.5" />}
              title="Checked against requirements"
              desc="Each compliance objective is tested — does the document address it?"
            />
            <StepIndicator
              icon={<Shield className="h-3.5 w-3.5" />}
              title="You get a verdict"
              desc="Pass, partial, or fail — with specific reasoning for each objective"
            />
          </div>
        </div>

        {/* Demo limitations */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="space-y-1 text-sm text-amber-800">
              <p className="font-medium text-amber-900">Demo limitations</p>
              <ul className="list-disc space-y-0.5 pl-4 text-xs">
                <li>Sample documents only — sign up to upload your own files</li>
                <li>
                  One compliance control per sample (full product assesses all relevant controls at
                  once)
                </li>
                <li>Results are not saved</li>
                <li>Limited to 3 runs per hour</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Running ─────────────────────────────────────────────
  if (step === "running") {
    return (
      <div className="space-y-6">
        <div className="rounded-lg bg-ft-cream/60 p-4 text-center">
          <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-ft-pink" />
          <h3 className="ft-serif mb-1 font-semibold text-ft-black">Processing Your Document</h3>
          <p className="text-slate-600 text-sm">
            AI is reading &quot;{selectedSample?.label}&quot; and checking it against compliance
            requirements
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              {selectedSample?.label}
            </CardTitle>
            <CardDescription>{selectedSample?.documentDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Checking:</strong> {selectedSample?.controlSummary}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-medium text-slate-900 text-sm">{progressMsg}</p>
            <span className="ft-mono font-semibold text-slate-700 text-sm">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2 bg-ft-grey-1" />
          <p className="mt-2 text-slate-500 text-xs">
            This is real AI analysis — typically takes 20-40 seconds
          </p>
        </div>
      </div>
    );
  }

  // ── Step 3: Results ─────────────────────────────────────────────
  if (step === "results" && result) {
    const assessment = result.assessment;
    const headline = assessmentHeadline({
      objectives: (assessment.objective_results ?? []).map((o) => ({
        status: o.result as ObjectiveStatus,
      })),
      overall: assessment.overall_result,
      confidence: assessment.overall_confidence ?? 0,
    });
    return (
      <div className="space-y-6">
        <div className="rounded-lg bg-green-50 p-4 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-600" />
          <div className="mb-1 flex items-center justify-center gap-2">
            <h3 className="font-medium text-green-900">Assessment Complete</h3>
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-100 text-amber-800 text-[10px]"
            >
              DEMO
            </Badge>
          </div>
          <p className="text-green-700 text-sm">
            Here&apos;s how &quot;{result.sample.label}&quot; scored against{" "}
            {result.sample.scfControlId}
          </p>
          <p className="mt-1 text-green-600 text-xs">
            Results are not saved. Sign up to persist and track assessments across your full
            compliance program.
          </p>
        </div>

        <div
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          data-testid="demo-results-headline"
        >
          <div className="mb-1 flex items-center gap-2 text-slate-500 text-xs">
            <Target className="h-3.5 w-3.5" />
            <span className="font-mono">{assessment.scf_control_id}</span>
            <span>—</span>
            <span>{assessment.control_title}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span className="text-3xl font-bold text-ft-black">
              {headline.total > 0 ? `${headline.passed} of ${headline.total}` : "—"}
            </span>
            <span className="text-slate-600 text-sm">objectives passed</span>
            {headline.passRatePercent !== null && (
              <span className="text-slate-500 text-sm">({headline.passRatePercent}%)</span>
            )}
            <Badge variant="outline" className={verdictBadgeClass(assessment.overall_result)}>
              {headline.verdict}
            </Badge>
          </div>
          <p className="mt-2 text-slate-500 text-xs" data-testid="demo-results-confidence">
            AI confidence in this evaluation: {headline.confidencePercent}%.{" "}
            <span className="text-slate-400">
              Confidence measures how sure the AI is about its read, not the pass rate.
            </span>
          </p>
          <p className="mt-2 text-sm text-slate-700">{assessment.summary}</p>
        </div>

        {assessment.objective_results && assessment.objective_results.length > 0 && (
          <AssessmentResultsDisplay
            hideSummary
            assessments={[
              {
                id: assessment.id,
                scf_control_id: assessment.scf_control_id,
                overall_result: assessment.overall_result,
                overall_confidence: assessment.overall_confidence,
                summary: assessment.summary,
                control_title: assessment.control_title,
                control_description: assessment.control_description,
                control_guidance: assessment.control_guidance,
                domain_name: assessment.domain_name,
                ai_generated: true,
                objective_results: assessment.objective_results,
                maturity_assessment: assessment.maturity_assessment,
                maturity_levels: assessment.maturity_levels,
              },
            ]}
          />
        )}

        <div className="flex justify-center">
          <Button variant="outline" onClick={reset}>
            Try Another Document
          </Button>
        </div>

        <div className="rounded-lg border border-ft-pink/30 bg-gradient-to-br from-ft-cream to-white p-6 text-center">
          <h3 className="ft-serif mb-2 text-lg font-bold text-ft-black">
            Ready to assess your own documents?
          </h3>
          <p className="mb-4 text-slate-600 text-sm">
            Upload your actual policies, procedures, and evidence. Graphletter assesses them against
            all relevant controls across 79+ frameworks — not just one.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild>
              <Link href={authUrl("signup")}>Sign up</Link>
            </Button>
            <Button variant="outline" onClick={reset}>
              Try Another Document
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-red-50 p-4 text-center">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-600" />
        <h3 className="mb-1 font-medium text-red-900">Assessment Failed</h3>
        <p className="text-red-700 text-sm">{errorMsg}</p>
      </div>
      <div className="flex justify-center">
        <Button variant="outline" onClick={reset}>
          Try Again
        </Button>
      </div>
    </div>
  );
}

function SamplePreview({ sample }: { sample: DemoSample }) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setExpanded(false);
    setContent(null);
    setFetchError(null);
  }, [sample.id]);

  async function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && content === null && !loading) {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(`/samples/${sample.sampleFileName}`);
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const text = await res.text();
        setContent(text);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Could not load document");
      } finally {
        setLoading(false);
      }
    }
  }

  const lineCount = content?.split("\n").length ?? null;
  const wordCount = content ? content.trim().split(/\s+/).length : null;

  return (
    <Card className="border-slate-200 bg-ft-cream/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-ft-pink" />
          {sample.label}
          <Badge variant="outline" className="ml-auto text-[10px]">
            {sample.evidenceType}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-slate-600 text-xs leading-relaxed">{sample.documentDescription}</p>
        <div className="rounded-md bg-white/80 p-2.5">
          <p className="mb-1 font-medium text-slate-500 text-[10px] uppercase tracking-wide">
            Compliance question being tested
          </p>
          <p className="text-slate-700 text-xs leading-relaxed">{sample.controlSummary}</p>
          <Badge variant="outline" className="mt-1.5 text-[10px]">
            {sample.scfControlId}
          </Badge>
        </div>

        <div className="rounded-md border border-slate-200 bg-white/80">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            data-testid="demo-sample-expand"
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-slate-700 text-xs transition-colors hover:bg-ft-cream/60"
          >
            <span className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-ft-pink" />
              <span className="font-medium">
                {expanded ? "Hide full document" : "View full document"}
              </span>
              <span className="text-[10px] text-slate-500">{sample.sampleFileName}</span>
            </span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            )}
          </button>
          {expanded && (
            <div className="border-slate-200 border-t">
              {loading && (
                <div className="flex items-center gap-2 px-3 py-4 text-slate-600 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading document…
                </div>
              )}
              {fetchError && <div className="px-3 py-3 text-red-700 text-xs">{fetchError}</div>}
              {content && !loading && !fetchError && (
                <>
                  <div className="flex items-center justify-between gap-2 border-slate-200 border-b bg-slate-50 px-3 py-1.5 text-[10px] text-slate-600">
                    <span>This is the exact text the AI reads during assessment.</span>
                    {lineCount !== null && wordCount !== null && (
                      <span className="font-medium">
                        {lineCount} lines · {wordCount} words
                      </span>
                    )}
                  </div>
                  <pre
                    data-testid="demo-sample-content"
                    className="max-h-80 overflow-auto whitespace-pre-wrap break-words px-3 py-3 font-mono text-[11px] leading-relaxed text-slate-800"
                  >
                    {content}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StepIndicator({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ft-pink text-white">
        {icon}
      </div>
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-gray-600">{desc}</p>
      </div>
    </div>
  );
}
