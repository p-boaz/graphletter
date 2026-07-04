"use client";

import { AlertTriangle, Inbox, RefreshCw, Shield } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { InboxItemCard } from "@/components/compliance-inbox/inbox-item-card";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InboxItem, InboxResult } from "@/lib/compliance/inbox-generator";

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-700";
  if (score >= 60) return "text-amber-700";
  return "text-red-700";
}

export default function ComplianceInboxPage() {
  const [inbox, setInbox] = useState<InboxResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/compliance/inbox", {
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        setInbox(data.inbox || null);
      } else {
        setError("Failed to load compliance inbox.");
      }
    } catch {
      setError("Unable to load compliance inbox.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  const handleUploadClick = useCallback((item: InboxItem) => {
    // Build query params for smart upload pre-fill
    const params = new URLSearchParams();
    if (item.context?.documentationArtifact) {
      params.set("artifact", item.context.documentationArtifact);
    }
    if (item.context?.controlIds?.length) {
      params.set("controls", item.context.controlIds.join(","));
    }
    if (item.context?.evidenceType) {
      params.set("evidence_type", item.context.evidenceType);
    }
    window.location.href = `/dashboard?upload=true&${params.toString()}`;
  }, []);

  if (loading) {
    return (
      <DashboardLayout
        title="Compliance Inbox"
        description="Prioritized actions to improve your compliance posture."
        showUploadButton={true}
      >
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
              <p className="mt-2 text-gray-600 text-sm">Generating compliance inbox...</p>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout
        title="Compliance Inbox"
        description="Prioritized actions to improve your compliance posture."
        showUploadButton={true}
      >
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
              <p className="text-red-600">{error}</p>
              <Button onClick={loadInbox} variant="outline" className="mt-2">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (!inbox || inbox.totalItems === 0) {
    return (
      <DashboardLayout
        title="Compliance Inbox"
        description="Prioritized actions to improve your compliance posture."
        showUploadButton={true}
      >
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-slate-600" data-testid="inbox-empty-state">
              <Shield className="mx-auto mb-3 h-12 w-12 text-slate-400" />
              <p className="font-medium text-lg">All clear!</p>
              <p className="mt-1 text-sm">
                No pending compliance actions.{" "}
                <Link href="/dashboard/frameworks" className="text-blue-600 underline">
                  Select frameworks to track
                </Link>{" "}
                to populate your inbox.
              </p>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const criticalCount = inbox.items.filter((i) => i.priority === "critical").length;
  const highCount = inbox.items.filter((i) => i.priority === "high").length;

  return (
    <DashboardLayout
      title="Compliance Inbox"
      description="Prioritized actions to improve your compliance posture."
      showUploadButton={true}
      actions={
        <Button variant="outline" size="sm" onClick={loadInbox} className="border-slate-300">
          <RefreshCw className="mr-1 h-4 w-4" />
          Refresh
        </Button>
      }
    >
      <div className="space-y-6" data-testid="compliance-inbox-page">
        {/* Summary bar */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {inbox.postureSummary && (
            <Card className="border border-slate-200">
              <CardContent className="p-4 text-center">
                <div
                  className={`font-bold text-2xl ${scoreColor(inbox.postureSummary.score)}`}
                  data-testid="inbox-posture-summary"
                >
                  {inbox.postureSummary.score.toFixed(1)}%
                </div>
                <div className="text-slate-500 text-sm">Posture Score</div>
              </CardContent>
            </Card>
          )}
          <Card className="border border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="font-bold text-2xl text-slate-900">{inbox.totalItems}</div>
              <div className="text-slate-500 text-sm">Action Items</div>
            </CardContent>
          </Card>
          <Card className="border border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="font-bold text-2xl text-red-700">{criticalCount + highCount}</div>
              <div className="text-slate-500 text-sm">
                Urgent ({criticalCount} critical, {highCount} high)
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Inbox items */}
        <Card className="ft-card">
          <CardHeader>
            <CardTitle className="ft-serif font-bold text-2xl text-ft-black">
              <Inbox className="mr-2 inline-block h-5 w-5" />
              Action Items
            </CardTitle>
            <CardDescription className="ft-sans text-base text-slate-600">
              Sorted by priority. Address critical and high items first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inbox.items.map((item) => (
                <InboxItemCard key={item.id} item={item} onUploadClick={handleUploadClick} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cache info */}
        <div className="rounded bg-slate-50 p-3 text-slate-500 text-xs">
          Generated at {new Date(inbox.generatedAt).toLocaleString()}. Next refresh at{" "}
          {new Date(inbox.cachedUntil).toLocaleString()}.
        </div>
      </div>
    </DashboardLayout>
  );
}
