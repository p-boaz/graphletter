"use client";

import { AlertTriangle, ArrowRight, Clock, FileUp, Shield, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { InboxItem, InboxItemPriority, InboxItemType } from "@/lib/compliance/inbox-generator";

const PRIORITY_BORDER: Record<InboxItemPriority, string> = {
  critical: "border-l-4 border-l-red-500",
  high: "border-l-4 border-l-amber-500",
  medium: "border-l-4 border-l-blue-500",
  low: "border-l-4 border-l-slate-300",
};

const PRIORITY_BADGE: Record<InboxItemPriority, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-amber-100 text-amber-800",
  medium: "bg-blue-100 text-blue-800",
  low: "bg-slate-100 text-slate-700",
};

const TYPE_ICON: Record<InboxItemType, React.ReactNode> = {
  stale_evidence: <AlertTriangle className="h-4 w-4 text-red-500" />,
  expiring_evidence: <Clock className="h-4 w-4 text-amber-500" />,
  missing_control: <Shield className="h-4 w-4 text-amber-600" />,
  partial_control: <Shield className="h-4 w-4 text-slate-400" />,
  high_leverage_upload: <TrendingUp className="h-4 w-4 text-blue-500" />,
};

interface InboxItemCardProps {
  item: InboxItem;
  onUploadClick?: (item: InboxItem) => void;
}

export function InboxItemCard({ item, onUploadClick }: InboxItemCardProps) {
  const isUploadAction =
    item.actionLabel === "Upload Evidence" || item.actionLabel === "Strengthen Evidence";

  return (
    <Card
      className={`${PRIORITY_BORDER[item.priority]}`}
      data-testid="inbox-item-card"
      data-priority={item.priority}
      data-type={item.type}
    >
      <CardContent className="flex items-start gap-4 p-4">
        <div className="mt-0.5 shrink-0">{TYPE_ICON[item.type]}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 font-medium text-xs ${PRIORITY_BADGE[item.priority]}`}
            >
              {item.priority}
            </span>
            <h3 className="truncate font-medium text-slate-900 text-sm">{item.title}</h3>
          </div>
          <p className="mt-1 text-slate-600 text-sm">{item.description}</p>
          {typeof item.metadata.groupedCount === "number" &&
            item.context?.controlIds &&
            item.context.controlIds.length > 1 && (
              <details className="mt-2 text-slate-500 text-xs">
                <summary className="cursor-pointer">
                  Show {item.context.controlIds.length} controls
                </summary>
                <p className="mt-1 font-mono leading-relaxed">
                  {item.context.controlIds.join(", ")}
                </p>
              </details>
            )}
        </div>
        <div className="shrink-0">
          {isUploadAction && onUploadClick ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUploadClick(item)}
              data-testid="inbox-action-button"
            >
              <FileUp className="mr-1 h-3.5 w-3.5" />
              {item.actionLabel}
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild data-testid="inbox-action-button">
              <Link href={item.actionUrl}>
                {item.actionLabel}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
