"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function EmptyTabState({
  icon,
  title,
  body,
  cta,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  cta?: { label: string; onClick?: () => void; href?: string };
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"
      data-testid="dashboard-empty-tab"
    >
      {icon && <div className="text-slate-400">{icon}</div>}
      <h3 className="ft-serif text-lg font-bold text-ft-black">{title}</h3>
      <p className="max-w-md text-sm text-slate-600">{body}</p>
      {cta &&
        (cta.href ? (
          <Button asChild variant="outline">
            <a href={cta.href}>{cta.label}</a>
          </Button>
        ) : (
          <Button variant="outline" onClick={cta.onClick}>
            {cta.label}
          </Button>
        ))}
    </div>
  );
}
