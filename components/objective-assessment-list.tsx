"use client";

import { Database, Quote } from "lucide-react";
import type React from "react";
import { AssessmentStatusBadge, ConfidenceBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export type EvidenceQuote = {
  text: string;
  supports?: string | null;
  start?: number;
  end?: number;
};

export type ObjectiveAssessmentItem = {
  id?: string;
  objective?: string;
  procedure?: string;
  expectedResults?: string;
  result?: string;
  confidence?: number;
  reasoning?: string;
  evidenceQuotes?: EvidenceQuote[];
  gaps?: string[];
  recommendations?: string[];
};

interface ObjectiveAssessmentListProps {
  objectives: ObjectiveAssessmentItem[];
  className?: string;
  emptyMessage?: string;
}

function EvidenceSpecimen({ quote }: { quote: EvidenceQuote }) {
  const caption = quote.supports?.trim() || "Evidence excerpt";

  return (
    <figure className="ft-paper relative overflow-hidden rounded-sm border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04),0_18px_36px_-28px_rgba(15,23,42,0.35)]">
      <div className="ft-rule mb-3" />
      <blockquote className="ft-serif text-sm leading-relaxed text-slate-900 sm:text-base">
        <span className="mr-1 text-2xl leading-none text-slate-300" aria-hidden="true">
          &quot;
        </span>
        {quote.text}
        <span className="ml-1 text-2xl leading-none text-slate-300" aria-hidden="true">
          &quot;
        </span>
      </blockquote>
      <figcaption className="ft-mono mt-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">
        {caption}
      </figcaption>
    </figure>
  );
}

function DetailBlock({
  label,
  children,
  tone = "slate",
}: {
  label: string;
  children: React.ReactNode;
  tone?: "slate" | "green" | "blue" | "amber" | "red";
}) {
  const toneClasses = {
    slate: "border-l-slate-300 text-slate-600",
    green: "border-l-green-500 text-green-700",
    blue: "border-l-slate-400 text-slate-700",
    amber: "border-l-amber-500 text-amber-700",
    red: "border-l-red-500 text-red-700",
  };

  return (
    <div className={cn("border-l-2 bg-white py-2 pl-3", toneClasses[tone])}>
      <p className="ft-eyebrow text-[11px]">{label}</p>
      <div className="mt-1 text-sm leading-relaxed text-slate-700">{children}</div>
    </div>
  );
}

export function ObjectiveAssessmentList({
  objectives,
  className,
  emptyMessage = "No objective-level details are available yet.",
}: ObjectiveAssessmentListProps) {
  if (objectives.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-600 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {objectives.map((objective, index) => {
        const result = objective.result || "not_applicable";
        const objectiveId = objective.id || `Objective ${index + 1}`;

        return (
          <section
            key={`${objectiveId}-${index}`}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-slate-700 text-xs">{objectiveId}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {typeof objective.confidence === "number" && (
                  <ConfidenceBadge confidence={objective.confidence} className="text-xs" />
                )}
                <AssessmentStatusBadge status={result} className="text-xs" />
              </div>
            </div>

            <div className="space-y-3">
              {objective.objective && (
                <DetailBlock label="SCF Objective" tone="green">
                  <div className="flex gap-2">
                    <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                    <p>{objective.objective}</p>
                  </div>
                </DetailBlock>
              )}
              {objective.procedure && (
                <DetailBlock label="Assessment Procedure" tone="amber">
                  <p>{objective.procedure}</p>
                </DetailBlock>
              )}
              {objective.expectedResults && (
                <DetailBlock label="Expected Results" tone="slate">
                  <p>{objective.expectedResults}</p>
                </DetailBlock>
              )}
              {objective.reasoning && (
                <DetailBlock label="Reasoning" tone="blue">
                  <p>{objective.reasoning}</p>
                </DetailBlock>
              )}
              {objective.evidenceQuotes && objective.evidenceQuotes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Quote className="h-3.5 w-3.5 text-slate-600" />
                    <p className="ft-eyebrow text-[11px] text-slate-600">Verified Evidence</p>
                  </div>
                  <div className="space-y-3">
                    {/* quote.supports renders once, as the specimen's figcaption —
                        repeating it here printed every explanation twice. */}
                    {objective.evidenceQuotes.map((quote, quoteIndex) => (
                      <EvidenceSpecimen key={`${objectiveId}-quote-${quoteIndex}`} quote={quote} />
                    ))}
                  </div>
                </div>
              )}
              {objective.gaps && objective.gaps.length > 0 && (
                <DetailBlock label="Gaps" tone="red">
                  <ul className="list-disc space-y-1 pl-4">
                    {objective.gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </DetailBlock>
              )}
              {objective.recommendations && objective.recommendations.length > 0 && (
                <DetailBlock label="Recommendations" tone="green">
                  <ul className="list-disc space-y-1 pl-4">
                    {objective.recommendations.map((recommendation) => (
                      <li key={recommendation}>{recommendation}</li>
                    ))}
                  </ul>
                </DetailBlock>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
