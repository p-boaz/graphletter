import type React from "react";
import { cn } from "@/lib/utils";

/**
 * Stat tile in the landing-page vocabulary: white card, hairline border,
 * black serif number, orange mono eyebrow label. Tone colors the NUMBER only
 * and is reserved for state that carries meaning (pass/warn/fail) — never
 * decorative pastel washes (QA 2026-07-09, "all the colors" feedback).
 */
type StatTone = "default" | "accent" | "success" | "warning" | "danger";

const toneToValueClass: Record<StatTone, string> = {
  default: "text-ft-black",
  accent: "text-ft-pink",
  success: "text-green-700",
  warning: "text-amber-700",
  danger: "text-red-700",
};

interface StatTileProps {
  value: React.ReactNode;
  label: string;
  sublabel?: string;
  tone?: StatTone;
  className?: string;
  "data-testid"?: string;
}

export function StatTile({
  value,
  label,
  sublabel,
  tone = "default",
  className,
  "data-testid": testId,
}: StatTileProps) {
  return (
    <div
      className={cn("rounded-lg border border-slate-200 bg-white p-4 text-center", className)}
      data-testid={testId}
    >
      <div className={cn("ft-serif font-bold text-3xl", toneToValueClass[tone])}>{value}</div>
      <div className="ft-eyebrow mt-1.5 text-[11px]">{label}</div>
      {sublabel ? <div className="ft-sans mt-1 text-slate-500 text-xs">{sublabel}</div> : null}
    </div>
  );
}
