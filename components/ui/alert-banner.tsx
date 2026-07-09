import type { ReactNode } from "react";

export function AlertBanner({
  tone,
  children,
  testId,
}: {
  tone: "info" | "success" | "warning" | "danger";
  children: ReactNode;
  testId?: string;
}) {
  const cls = {
    info: "border-slate-200 bg-ft-cream/60 text-slate-800",
    success: "border-green-200 bg-green-50 text-green-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  }[tone];
  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${cls}`} data-testid={testId}>
      {children}
    </div>
  );
}
