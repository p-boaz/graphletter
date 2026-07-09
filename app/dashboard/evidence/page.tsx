"use client";

import { Eye, FileUp, Search } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { EvidenceFreshnessDot } from "@/components/evidence-freshness-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EvidenceStatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EvidenceRecord {
  id: string;
  file_name: string;
  scf_control_id: string;
  evidence_type: string;
  evidence_status: string;
  submitted_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  evidence_group_id?: string;
  erl_global_id?: string;
  metadata?: {
    documentation_artifact?: string;
    smart_upload?: boolean;
  };
}

interface EvidenceGroup {
  groupId: string;
  representative: EvidenceRecord;
  records: EvidenceRecord[];
  allControls: string;
  controlCount: number;
  uploadCount: number;
}

interface EvidenceImportRow {
  rowNumber: number;
  status: "valid" | "invalid";
  errors: string[];
  values: {
    file_name: string;
    scf_control_id: string;
    evidence_type: string;
    erl_global_id: string | null;
    documentation_artifact: string | null;
    description: string | null;
    submitted_at: string | null;
  };
}

interface EvidenceImportResponse {
  success: boolean;
  error?: string;
  summary?: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
  rows?: EvidenceImportRow[];
  committedRows?: number;
}

export default function EvidencePage() {
  const [evidenceRecords, setEvidenceRecords] = useState<EvidenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [controlFilter, setControlFilter] = useState("all");
  const [selectedEvidenceGroup, setSelectedEvidenceGroup] = useState<EvidenceGroup | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const { user: currentUser } = useAuth();
  const [approvalFeedback, setApprovalFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importContent, setImportContent] = useState("");
  const [importFormat, setImportFormat] = useState<"csv" | "json" | null>(null);
  const [importPreview, setImportPreview] = useState<EvidenceImportResponse | null>(null);
  const [importError, setImportError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importCommittedRows, setImportCommittedRows] = useState<number | null>(null);
  const [freshnessMap, setFreshnessMap] = useState<
    Map<string, { status: "fresh" | "expiring" | "stale"; daysUntilExpiry: number }>
  >(new Map());

  const loadEvidenceData = useCallback(async () => {
    setLoading(true);
    try {
      const [evidenceResponse, freshnessResponse] = await Promise.all([
        fetch(`/api/evidence/history`, { cache: "no-store" }),
        fetch(`/api/compliance/freshness`, { cache: "no-store" }),
      ]);
      if (evidenceResponse.ok) {
        const evidenceData = await evidenceResponse.json();
        setEvidenceRecords(evidenceData.evidence || []);
      }
      if (freshnessResponse.ok) {
        const freshnessData = await freshnessResponse.json();
        const items = freshnessData.freshness?.items || [];
        const map = new Map<
          string,
          { status: "fresh" | "expiring" | "stale"; daysUntilExpiry: number }
        >();
        for (const item of items) {
          map.set(item.evidenceId, {
            status: item.status,
            daysUntilExpiry: item.daysUntilExpiry,
          });
        }
        setFreshnessMap(map);
      }
    } catch (error) {
      console.error("Error loading evidence data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvidenceData();
  }, [loadEvidenceData]);

  const resetImportState = useCallback(() => {
    setImportFileName("");
    setImportContent("");
    setImportFormat(null);
    setImportPreview(null);
    setImportError("");
    setImportBusy(false);
    setImportCommittedRows(null);
  }, []);

  const handleImportFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImportPreview(null);
    setImportCommittedRows(null);
    setImportError("");

    if (!file) {
      setImportFileName("");
      setImportContent("");
      setImportFormat(null);
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    const format = extension === "csv" || extension === "json" ? extension : null;
    if (!format) {
      setImportFileName(file.name);
      setImportContent("");
      setImportFormat(null);
      setImportError("Choose a .csv or .json import file.");
      return;
    }

    setImportFileName(file.name);
    setImportFormat(format);
    setImportContent(await file.text());
  }, []);

  const submitImport = useCallback(
    async (mode: "preview" | "commit") => {
      if (!importFormat || !importContent) {
        setImportError("Choose a CSV or JSON import file first.");
        return;
      }

      setImportBusy(true);
      setImportError("");
      setImportCommittedRows(null);

      try {
        const response = await fetch("/api/evidence/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            format: importFormat,
            content: importContent,
          }),
        });
        const data = (await response.json()) as EvidenceImportResponse;
        setImportPreview(data);

        if (!response.ok) {
          setImportError(data.error || "Evidence import failed.");
          return;
        }

        if (mode === "commit") {
          setImportCommittedRows(data.committedRows ?? data.summary?.validRows ?? 0);
          await loadEvidenceData();
        }
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "Evidence import failed.");
      } finally {
        setImportBusy(false);
      }
    },
    [importContent, importFormat, loadEvidenceData]
  );

  const openEvidenceDetails = useCallback((group: EvidenceGroup) => {
    setSelectedEvidenceGroup(group);
    setApprovalFeedback(null);
    setRejectionReason("");
  }, []);

  const submitEvidenceReview = useCallback(
    async (action: "approve" | "reject") => {
      const representative = selectedEvidenceGroup?.representative;
      if (!representative) {
        return;
      }

      const trimmedReason = rejectionReason.trim();
      if (action === "reject" && !trimmedReason) {
        setApprovalFeedback({
          type: "error",
          message: "Rejection reason is required.",
        });
        return;
      }

      setApprovalBusy(true);
      setApprovalFeedback(null);

      const reviewedAt = new Date().toISOString();
      try {
        const response = await fetch(`/api/evidence/${representative.id}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewed_at: reviewedAt,
            ...(action === "reject" ? { rejection_reason: trimmedReason } : {}),
          }),
        });
        const data = (await response.json()) as { message?: string; error?: string };

        if (!response.ok) {
          setApprovalFeedback({
            type: "error",
            message: data.error || `Failed to ${action} evidence.`,
          });
          return;
        }

        const nextStatus = action === "approve" ? "approved" : "rejected";
        setSelectedEvidenceGroup((current) =>
          current
            ? {
                ...current,
                representative: {
                  ...current.representative,
                  evidence_status: nextStatus,
                  reviewed_by: "You",
                  reviewed_at: reviewedAt,
                  rejection_reason: action === "reject" ? trimmedReason : null,
                },
                records: current.records.map((record) => ({
                  ...record,
                  evidence_status: nextStatus,
                  reviewed_by: "You",
                  reviewed_at: reviewedAt,
                  rejection_reason: action === "reject" ? trimmedReason : null,
                })),
              }
            : current
        );
        setApprovalFeedback({
          type: "success",
          message: data.message || `Evidence ${nextStatus} successfully.`,
        });
        setRejectionReason("");
        await loadEvidenceData();
      } catch (error) {
        setApprovalFeedback({
          type: "error",
          message: error instanceof Error ? error.message : `Failed to ${action} evidence.`,
        });
      } finally {
        setApprovalBusy(false);
      }
    },
    [loadEvidenceData, rejectionReason, selectedEvidenceGroup]
  );

  const formatDate = (value?: string | null) => {
    if (!value) {
      return "-";
    }
    return new Date(value).toISOString().split("T")[0];
  };

  // First group by upload group id
  const evidenceGroupsMap = new Map<string, EvidenceRecord[]>();
  evidenceRecords.forEach((evidence) => {
    const groupId = evidence.evidence_group_id || evidence.id;
    if (!evidenceGroupsMap.has(groupId)) {
      evidenceGroupsMap.set(groupId, []);
    }
    evidenceGroupsMap.get(groupId)!.push(evidence);
  });

  const uploadGroups: EvidenceGroup[] = Array.from(evidenceGroupsMap.entries()).map(
    ([groupId, records]) => {
      const representative = [...records].sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      )[0];
      const uniqueControls = [...new Set(records.map((r) => r.scf_control_id))].sort();
      return {
        groupId,
        representative,
        records,
        allControls: uniqueControls.join(", "),
        controlCount: uniqueControls.length,
        uploadCount: 1,
      };
    }
  );

  // Collapse repeated uploads of the same artifact/file into one latest row.
  const dedupedByArtifactFile = new Map<string, EvidenceGroup>();
  for (const group of uploadGroups) {
    const artifact = group.representative.metadata?.documentation_artifact || "";
    const dedupeKey = `${artifact}::${group.representative.file_name.toLowerCase()}`;
    const existing = dedupedByArtifactFile.get(dedupeKey);

    if (!existing) {
      dedupedByArtifactFile.set(dedupeKey, { ...group });
      continue;
    }

    existing.uploadCount += 1;
    const mergedControls = new Set<string>([
      ...existing.allControls
        .split(",")
        .map((control) => control.trim())
        .filter(Boolean),
      ...group.allControls
        .split(",")
        .map((control) => control.trim())
        .filter(Boolean),
    ]);
    existing.allControls = [...mergedControls].sort().join(", ");
    existing.controlCount = mergedControls.size;

    const existingSubmittedAt = new Date(existing.representative.submitted_at).getTime();
    const currentSubmittedAt = new Date(group.representative.submitted_at).getTime();
    if (currentSubmittedAt > existingSubmittedAt) {
      existing.groupId = group.groupId;
      existing.representative = group.representative;
      existing.records = group.records;
    }
  }

  const filteredEvidenceGroups: EvidenceGroup[] = Array.from(dedupedByArtifactFile.values())
    .sort(
      (a, b) =>
        new Date(b.representative.submitted_at).getTime() -
        new Date(a.representative.submitted_at).getTime()
    )
    .filter((group) => {
      const matchesSearch =
        group.representative.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.allControls.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || group.representative.evidence_status === statusFilter;
      const matchesControl =
        controlFilter === "all" || group.records.some((r) => r.scf_control_id === controlFilter);

      return matchesSearch && matchesStatus && matchesControl;
    });

  // Get unique controls for filter dropdown
  const uniqueControls = [...new Set(evidenceRecords.map((e) => e.scf_control_id))].sort();

  return (
    <DashboardLayout
      title="Evidence Records"
      description="View and manage all uploaded evidence files"
      showUploadButton={true}
    >
      <Card className="ft-card">
        {/* CardContent defaults to pt-0 (expects a CardHeader); without one the
            toolbar sat flush against the card's top edge. */}
        <CardContent className="pt-6">
          {/* Filters */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-gray-400" />
                <Input
                  placeholder="Search by filename or control ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="outdated">Outdated</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              data-testid="evidence-import-open"
              className="w-full sm:w-auto"
              onClick={() => setImportOpen(true)}
            >
              <FileUp className="mr-2 h-4 w-4" />
              Bulk import
            </Button>
            <Select value={controlFilter} onValueChange={setControlFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by control" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Controls</SelectItem>
                {uniqueControls.map((control) => (
                  <SelectItem key={control} value={control}>
                    {control}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Evidence Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Document Artifact</TableHead>
                  <TableHead>Controls Mapped</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      Loading evidence records...
                    </TableCell>
                  </TableRow>
                ) : filteredEvidenceGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      No evidence found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvidenceGroups.map((group) => {
                    const freshness = freshnessMap.get(group.representative.id);
                    return (
                      <TableRow key={group.groupId} data-testid="evidence-row">
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            {freshness && (
                              <TooltipProvider delayDuration={0}>
                                <EvidenceFreshnessDot
                                  status={freshness.status}
                                  daysUntilExpiry={freshness.daysUntilExpiry}
                                />
                              </TooltipProvider>
                            )}
                            {group.representative.file_name}
                          </span>
                          {group.representative.metadata?.smart_upload && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Smart Upload
                            </Badge>
                          )}
                          {group.uploadCount > 1 && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {group.uploadCount} uploads
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-gray-600 text-sm">
                            {group.representative.metadata?.documentation_artifact || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-sm">
                              {group.controlCount} control
                              {group.controlCount !== 1 ? "s" : ""}
                            </div>
                            <div
                              className="max-w-xs truncate text-gray-500 text-xs"
                              title={group.allControls}
                            >
                              {group.allControls}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <EvidenceStatusBadge status={group.representative.evidence_status} />
                        </TableCell>
                        <TableCell className="ft-mono whitespace-nowrap text-slate-600 text-xs">
                          {new Date(group.representative.submitted_at).toISOString().split("T")[0]}
                        </TableCell>
                        <TableCell>
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  data-testid="evidence-view-action"
                                  aria-label={`View evidence details for ${group.representative.file_name}`}
                                  onClick={() => openEvidenceDetails(group)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View evidence details</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {importOpen && (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setImportOpen(false);
              resetImportState();
            }
          }}
        >
          <DialogContent
            className="max-h-[85vh] max-w-4xl overflow-y-auto"
            data-testid="evidence-import-dialog"
          >
            <DialogHeader>
              <DialogTitle>Bulk import evidence</DialogTitle>
              <DialogDescription>
                Preview the rows in your CSV or JSON file before importing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="evidence-import-file">Import file</Label>
                <Input
                  id="evidence-import-file"
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  data-testid="evidence-import-file"
                  onChange={handleImportFileChange}
                />
                {importFileName && <p className="text-slate-600 text-sm">{importFileName}</p>}
              </div>

              {importError && (
                <div
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800 text-sm"
                  data-testid="evidence-import-error"
                  role="alert"
                >
                  {importError}
                </div>
              )}

              {importCommittedRows !== null && (
                <div
                  className="rounded-md border border-green-200 bg-green-50 p-3 text-green-800 text-sm"
                  data-testid="evidence-import-success"
                  role="status"
                >
                  Imported {importCommittedRows} evidence record
                  {importCommittedRows === 1 ? "" : "s"}.
                </div>
              )}

              {importPreview?.summary && (
                <div className="grid gap-3 sm:grid-cols-3" data-testid="evidence-import-summary">
                  <div className="rounded-md border p-3">
                    <p className="text-slate-500 text-xs">Rows</p>
                    <p className="font-semibold text-lg">{importPreview.summary.totalRows}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-slate-500 text-xs">Valid</p>
                    <p className="font-semibold text-green-700 text-lg">
                      {importPreview.summary.validRows}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-slate-500 text-xs">Invalid</p>
                    <p className="font-semibold text-lg text-red-700">
                      {importPreview.summary.invalidRows}
                    </p>
                  </div>
                </div>
              )}

              {importPreview?.rows && importPreview.rows.length > 0 && (
                <div className="rounded-md border" data-testid="evidence-import-preview">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead>Control</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.rows.map((row) => (
                        <TableRow key={row.rowNumber} data-testid="evidence-import-row">
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell>
                            <Badge variant={row.status === "valid" ? "default" : "destructive"}>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{row.values.file_name || "-"}</TableCell>
                          <TableCell>{row.values.scf_control_id || "-"}</TableCell>
                          <TableCell>{row.values.evidence_type || "-"}</TableCell>
                          <TableCell className="max-w-sm text-sm">
                            {row.errors.length > 0 ? row.errors.join(" ") : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => submitImport("preview")}
                disabled={importBusy || !importContent}
                data-testid="evidence-import-preview-button"
              >
                Preview
              </Button>
              <Button
                type="button"
                onClick={() => submitImport("commit")}
                disabled={
                  importBusy || !importPreview?.summary || importPreview.summary.invalidRows > 0
                }
                data-testid="evidence-import-commit-button"
              >
                Commit import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={selectedEvidenceGroup !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEvidenceGroup(null);
            setApprovalFeedback(null);
            setRejectionReason("");
          }
        }}
      >
        <DialogContent
          className="max-h-[85vh] max-w-2xl overflow-y-auto"
          data-testid="evidence-detail-dialog"
        >
          <DialogHeader>
            <DialogTitle>Evidence details</DialogTitle>
            <DialogDescription>
              Review the uploaded file context and mapped controls for this evidence group.
            </DialogDescription>
          </DialogHeader>

          {selectedEvidenceGroup && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 rounded-lg border bg-slate-50 p-4 md:grid-cols-2">
                <div>
                  <p className="font-medium text-slate-900">File name</p>
                  <p className="text-slate-700" data-testid="evidence-detail-file-name">
                    {selectedEvidenceGroup.representative.file_name}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Artifact</p>
                  <p className="text-slate-700">
                    {selectedEvidenceGroup.representative.metadata?.documentation_artifact || "-"}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Status</p>
                  <EvidenceStatusBadge
                    status={selectedEvidenceGroup.representative.evidence_status}
                  />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Uploaded</p>
                  <p className="text-slate-700">
                    {formatDate(selectedEvidenceGroup.representative.submitted_at)}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Uploads merged</p>
                  <p className="text-slate-700">{selectedEvidenceGroup.uploadCount}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Reviewer</p>
                  <p className="text-slate-700" data-testid="evidence-reviewer">
                    {(() => {
                      const reviewerId =
                        selectedEvidenceGroup.representative.reviewed_by ||
                        selectedEvidenceGroup.representative.approved_by;
                      if (!reviewerId) return "-";
                      // Raw account UUIDs mean nothing to a human reviewer.
                      return reviewerId === currentUser?.id
                        ? currentUser?.email || "You"
                        : reviewerId;
                    })()}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Reviewed</p>
                  <p className="text-slate-700">
                    {formatDate(
                      selectedEvidenceGroup.representative.reviewed_at ||
                        selectedEvidenceGroup.representative.approved_at
                    )}
                  </p>
                </div>
              </div>

              {selectedEvidenceGroup.representative.rejection_reason && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                  <p className="font-medium text-red-900">Rejection reason</p>
                  <p className="mt-1 text-red-800" data-testid="evidence-rejection-reason">
                    {selectedEvidenceGroup.representative.rejection_reason}
                  </p>
                </div>
              )}

              {/* Only records still awaiting review get review actions — offering
                  "Approve" on an already-approved record reads as a bug
                  (QA 2026-07-09 round 5). */}
              {["submitted", "under_review"].includes(
                selectedEvidenceGroup.representative.evidence_status
              ) ? (
                <div className="space-y-3 rounded-lg border p-4">
                  <div>
                    <p className="font-medium text-slate-900">Review action</p>
                    <p className="mt-1 text-slate-600">
                      Approve the evidence group or reject it with a reason.
                    </p>
                  </div>
                  {approvalFeedback && (
                    <div
                      className={
                        approvalFeedback.type === "success"
                          ? "rounded-md border border-green-200 bg-green-50 p-3 text-green-800"
                          : "rounded-md border border-red-200 bg-red-50 p-3 text-red-800"
                      }
                      data-testid="evidence-review-feedback"
                      role={approvalFeedback.type === "success" ? "status" : "alert"}
                    >
                      {approvalFeedback.message}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="evidence-rejection-input">Rejection reason</Label>
                    <Textarea
                      id="evidence-rejection-input"
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                      placeholder="Required when rejecting evidence"
                      data-testid="evidence-rejection-input"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      onClick={() => submitEvidenceReview("approve")}
                      disabled={approvalBusy}
                      data-testid="evidence-approve-button"
                    >
                      Approve evidence
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => submitEvidenceReview("reject")}
                      disabled={approvalBusy || !rejectionReason.trim()}
                      className="disabled:bg-slate-200 disabled:text-slate-500"
                      data-testid="evidence-reject-button"
                    >
                      Reject evidence
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-lg border bg-slate-50 p-4 text-slate-600"
                  data-testid="evidence-review-complete-note"
                >
                  {selectedEvidenceGroup.representative.evidence_status === "approved"
                    ? "This evidence group has been reviewed and approved. Upload a new version to supersede it."
                    : "This evidence group was rejected. Upload a revised version to restart review."}
                </div>
              )}

              <div className="rounded-lg border p-4">
                <p className="font-medium text-slate-900">Mapped controls</p>
                <p className="mt-1 text-slate-700" data-testid="evidence-detail-controls">
                  {selectedEvidenceGroup.allControls}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="font-medium text-slate-900">Evidence records in this group</p>
                <ul
                  className="mt-2 space-y-2 text-slate-700"
                  data-testid="evidence-detail-record-list"
                >
                  {selectedEvidenceGroup.records.map((record) => (
                    <li key={record.id} className="rounded border border-slate-100 bg-slate-50 p-2">
                      <p className="font-medium">{record.scf_control_id}</p>
                      <p className="text-xs capitalize">{record.evidence_type}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
