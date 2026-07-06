"use client";

import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { glossaryTerms } from "@/lib/content/compliance-explainer";

/**
 * In-place explainer for helper text inside dialogs. Renders link-styled
 * trigger text that opens a popover with the glossary definition instead of
 * navigating to /docs and destroying the user's in-progress dialog state.
 * Content is looked up from lib/content/compliance-explainer.ts by the same
 * id the docs page uses as its anchor, so copy has a single source of truth.
 */
export function InlineHelp({
  termId,
  children,
  testId,
}: {
  termId: string;
  children: ReactNode;
  testId?: string;
}) {
  const entry = glossaryTerms.find((term) => term.id === termId);

  // Unknown id: fall back to a plain new-tab docs link so nothing dead-ends.
  if (!entry) {
    return (
      <a
        href={`/docs#${termId}`}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={testId}
        className="font-medium underline underline-offset-4"
      >
        {children}
      </a>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          className="font-medium underline decoration-dotted underline-offset-4 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 text-sm"
        data-testid={testId ? `${testId}-content` : undefined}
      >
        <p className="font-semibold text-slate-900">{entry.term}</p>
        <p className="mt-2 text-slate-700 leading-relaxed">{entry.plainDefinition}</p>
        <p className="mt-2 text-slate-700 leading-relaxed">
          <span className="font-medium text-slate-900">In Graphletter:</span>{" "}
          {entry.graphletterDefinition}
        </p>
        <a
          href={`/docs#${entry.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 underline underline-offset-4 hover:text-slate-700"
        >
          Full docs
          <ExternalLink className="h-3 w-3" />
        </a>
      </PopoverContent>
    </Popover>
  );
}
