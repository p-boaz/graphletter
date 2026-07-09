"use client";

import { FileUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { AssessmentReviewDialog } from "@/components/assessment-review-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProgressSession } from "@/hooks/use-progress-tracker";
import { createSmartEvidenceWorkflowClient } from "@/lib/client/smart-evidence-workflow";
import { AssessmentProgressView } from "./assessment-progress-view";
import type {
  AssessmentWorkflowResponse,
  DocumentationArtifact,
  EvidenceHistoryItem,
  ExistingEvidence,
  LiveAssessmentProgress,
  LiveControlResult,
  SmartEvidenceUploadProps,
  SmartUploadResult,
  UploadOnlyResult,
} from "./types";
import { UploadForm } from "./upload-form";
import { UploadResultsView } from "./upload-results-view";
import { createInitialAssessmentProgress, toAssessmentResult } from "./utils";

const SMART_UPLOAD_DIALOG_ID = "smart-evidence-upload-dialog";

export function SmartEvidenceUpload({
  onEvidenceProcessed,
  defaultDocumentationArtifact,
  defaultDescription,
  defaultControlIds,
  defaultFrameworkId,
  defaultEvidenceType,
  open,
  onOpenChange,
  hideTrigger,
  dialogTitle,
}: SmartEvidenceUploadProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalIsOpen;
  const setIsOpen = useCallback(
    (next: boolean) => {
      if (isControlled) {
        onOpenChange?.(next);
      } else {
        setInternalIsOpen(next);
      }
    },
    [isControlled, onOpenChange]
  );
  const [uploading, setUploading] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [artifactComboboxOpen, setArtifactComboboxOpen] = useState(false);

  // Form state
  const [evidenceType, setEvidenceType] = useState<string>(defaultEvidenceType ?? "document");
  const [description, setDescription] = useState<string>(defaultDescription ?? "");
  const [documentationArtifact, setDocumentationArtifact] = useState<string>(
    defaultDocumentationArtifact ?? ""
  );
  const [classifyingArtifact, setClassifyingArtifact] = useState(false);
  const [artifactAiSuggested, setArtifactAiSuggested] = useState(false);

  // Documentation artifacts
  const [artifacts, setArtifacts] = useState<DocumentationArtifact[]>([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [selectedArtifactControls, setSelectedArtifactControls] = useState<string[]>([]);

  // Version management
  const [existingEvidence, setExistingEvidence] = useState<ExistingEvidence | null>(null);
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [liveAssessmentProgress, setLiveAssessmentProgress] = useState<LiveAssessmentProgress>(
    createInitialAssessmentProgress()
  );

  // Real-time progress tracking
  const { progressState, sessionId, startSession, endSession, reportError } = useProgressSession({
    onProgress: (update) => {
      console.log("Progress update:", update);

      if (typeof update.message === "string" && update.message.length > 0) {
        setProcessingStage(update.message);
      }

      const metadata =
        update.metadata && typeof update.metadata === "object"
          ? (update.metadata as Record<string, unknown>)
          : null;
      const phase = typeof metadata?.phase === "string" ? metadata.phase : null;
      const isAssessmentStage =
        update.stage === "assessment-started" ||
        update.stage === "assessing-control" ||
        update.stage === "assessment-finalizing" ||
        phase === "assessment-started" ||
        phase === "control-started" ||
        phase === "control-completed" ||
        phase === "assessment-finalizing";

      if (!isAssessmentStage) return;

      setLiveAssessmentProgress((prev) => {
        const next: LiveAssessmentProgress = {
          ...prev,
        };

        if (typeof metadata?.totalControls === "number") {
          next.totalControls = metadata.totalControls;
        }

        if (typeof metadata?.completedControls === "number") {
          next.completedControls = metadata.completedControls;
        }

        if (typeof metadata?.currentControlId === "string") {
          next.currentControlId = metadata.currentControlId;
        }

        if (typeof metadata?.currentControlNumber === "number") {
          next.currentControlNumber = metadata.currentControlNumber;
        }

        if (typeof metadata?.averageControlDurationMs === "number") {
          next.averageControlDurationMs = metadata.averageControlDurationMs;
        } else if (metadata?.averageControlDurationMs === null) {
          next.averageControlDurationMs = null;
        }

        if (typeof metadata?.estimatedRemainingMs === "number") {
          next.estimatedRemainingMs = metadata.estimatedRemainingMs;
        } else if (metadata?.estimatedRemainingMs === null) {
          next.estimatedRemainingMs = null;
        }

        if (phase === "control-completed" && typeof metadata?.currentControlId === "string") {
          const result = toAssessmentResult(metadata.controlResult);
          if (result) {
            const completedResult: LiveControlResult = {
              controlId: metadata.currentControlId,
              result,
              confidence:
                typeof metadata.controlConfidence === "number" ? metadata.controlConfidence : null,
              status: typeof metadata.controlStatus === "string" ? metadata.controlStatus : null,
              completedAt: update.timestamp,
            };

            next.results = [
              ...next.results.filter(
                (existing) => existing.controlId !== completedResult.controlId
              ),
              completedResult,
            ];
          }
        }

        return next;
      });
    },
    onComplete: (sessionId) => {
      console.log("Session completed:", sessionId);
      toast.success("Upload and assessment completed successfully!");
    },
    onError: (error) => {
      console.error(error);
      toast.error("An error occurred during processing.");
    },
  });
  const [versionAction, setVersionAction] = useState<"replace" | "keep_both" | null>(null);

  // Upload and assessment phases
  const [fileContent, setFileContent] = useState<string>("");
  const [imageData, setImageData] = useState<{
    base64: string;
    mimeType: string;
  } | null>(null);
  const [uploadOnlyResult, setUploadOnlyResult] = useState<UploadOnlyResult | null>(null);
  const [uploadResult, setUploadResult] = useState<SmartUploadResult | null>(null);
  const [processingStage, setProcessingStage] = useState<string>("");

  // Failed controls for retry
  const [failedControls, setFailedControls] = useState<
    Array<{ control_id: string; error: string }>
  >([]);
  const [retrying, setRetrying] = useState(false);

  // Review step state
  const [pendingAssessmentResult, setPendingAssessmentResult] = useState<SmartUploadResult | null>(
    null
  );
  const [showReviewDialog, setShowReviewDialog] = useState(false);

  const getFileTypeDescription = useCallback((file: File) => {
    if (file.type === "application/pdf") return "PDF document";
    if (file.type.includes("word")) return "Word document";
    if (file.type.includes("image/")) return "image (OCR processing)";
    if (file.type.includes("sheet") || file.type.includes("excel")) return "spreadsheet";
    if (file.type === "text/plain") return "text file";
    if (file.type === "text/csv") return "CSV file";
    return "document";
  }, []);

  const loadDocumentationArtifacts = useCallback(async () => {
    setLoadingArtifacts(true);
    try {
      const response = await fetch("/api/erl/artifacts");
      if (response.ok) {
        const data = await response.json();
        const artifactList = Array.isArray(data.artifacts)
          ? (data.artifacts as DocumentationArtifact[])
          : [];
        setArtifacts(artifactList);

        if (artifactList.length === 0) {
          toast.error("No documentation artifacts are currently available for selection.");
        }
      } else {
        toast.error("Failed to load documentation artifacts");
      }
    } catch (error) {
      console.error("Error loading artifacts:", error);
      toast.error("Failed to load documentation artifacts");
    } finally {
      setLoadingArtifacts(false);
    }
  }, []);

  const checkForExistingEvidence = useCallback(async (artifact: string) => {
    if (!artifact) {
      setExistingEvidence(null);
      return;
    }

    try {
      const response = await fetch(
        `/api/evidence/history?documentation_artifact=${encodeURIComponent(artifact)}`
      );
      if (response.ok) {
        const data = (await response.json()) as {
          evidence?: EvidenceHistoryItem[];
        };
        if (data.evidence && data.evidence.length > 0) {
          const mostRecent = data.evidence
            .filter((e) => e.metadata?.documentation_artifact === artifact)
            .sort((a, b) => (b.version || 1) - (a.version || 1))[0];

          if (mostRecent) {
            setExistingEvidence({
              id: mostRecent.id,
              file_name: mostRecent.file_name,
              version: mostRecent.version || 1,
              submitted_at: mostRecent.submitted_at,
              evidence_status: mostRecent.evidence_status,
            });
            setShowVersionDialog(true);
            return;
          }
        }
      }
    } catch (error) {
      console.error("Error checking for existing evidence:", error);
    }

    setExistingEvidence(null);
    setShowVersionDialog(false);
    setVersionAction(null);
  }, []);

  const resetDialog = useCallback(() => {
    setUploadResult(null);
    setUploadOnlyResult(null);
    setFileContent("");
    setImageData(null);
    setDescription(defaultDescription ?? "");
    setDocumentationArtifact(defaultDocumentationArtifact ?? "");
    setArtifactAiSuggested(false);
    setClassifyingArtifact(false);
    setArtifactComboboxOpen(false);
    setSelectedArtifactControls([]);
    setExistingEvidence(null);
    setShowVersionDialog(false);
    setVersionAction(null);
    setProcessingStage("");
    setLiveAssessmentProgress(createInitialAssessmentProgress());
    setPendingAssessmentResult(null);
    setShowReviewDialog(false);
    setFailedControls([]);
    setRetrying(false);

    if (sessionId) {
      if (progressState.status === "active" || progressState.status === "connected") {
        void endSession({
          status: "error",
          message: "Workflow cancelled by user",
        });
      } else {
        void endSession();
      }
    }
  }, [
    defaultDescription,
    defaultDocumentationArtifact,
    endSession,
    progressState.status,
    sessionId,
  ]);

  // Load documentation artifacts on dialog open
  useEffect(() => {
    if (isOpen && artifacts.length === 0) {
      loadDocumentationArtifacts();
    }
  }, [artifacts.length, isOpen, loadDocumentationArtifacts]);

  // Sync defaults into state
  const prevDefaultsRef = useRef({
    defaultDescription,
    defaultDocumentationArtifact,
    isOpen,
  });
  useEffect(() => {
    const prev = prevDefaultsRef.current;
    const defaultsChanged =
      prev.defaultDescription !== defaultDescription ||
      prev.defaultDocumentationArtifact !== defaultDocumentationArtifact ||
      prev.isOpen !== isOpen;
    prevDefaultsRef.current = {
      defaultDescription,
      defaultDocumentationArtifact,
      isOpen,
    };

    if (!defaultsChanged) return;

    if (isOpen) {
      if (defaultDescription !== undefined) {
        setDescription(defaultDescription);
      }
      if (defaultDocumentationArtifact !== undefined) {
        setDocumentationArtifact(defaultDocumentationArtifact || "");
      }
    } else {
      setDescription(defaultDescription ?? "");
      setDocumentationArtifact(defaultDocumentationArtifact ? defaultDocumentationArtifact : "");
    }
  }, [defaultDescription, defaultDocumentationArtifact, isOpen]);

  // Canonicalize artifact name once the list loads: if the caller passed a
  // string that doesn't exactly match any known artifact, try a case-insensitive
  // match so prefill from control titles like "Data Privacy Program" still works.
  useEffect(() => {
    if (!documentationArtifact || artifacts.length === 0) return;
    if (artifacts.some((a) => a.artifact === documentationArtifact)) return;
    const target = documentationArtifact.trim().toLowerCase();
    const match = artifacts.find((a) => a.artifact.trim().toLowerCase() === target);
    if (match) {
      setDocumentationArtifact(match.artifact);
    }
  }, [artifacts, documentationArtifact]);

  // Update selected controls when artifact changes
  useEffect(() => {
    if (documentationArtifact) {
      const selectedArtifact = artifacts.find((a) => a.artifact === documentationArtifact);
      setSelectedArtifactControls(selectedArtifact?.controls.map((c) => c.scf_control_id) || []);
      checkForExistingEvidence(documentationArtifact);
    } else {
      setSelectedArtifactControls([]);
      setExistingEvidence(null);
    }
  }, [documentationArtifact, artifacts, checkForExistingEvidence]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];

      let artifactToUse = documentationArtifact;

      if (!artifactToUse) {
        setClassifyingArtifact(true);
        try {
          const response = await fetch("/api/artifacts/classify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, mimeType: file.type }),
          });
          if (response.ok) {
            const data = (await response.json()) as { artifact: string | null };
            if (data.artifact) {
              artifactToUse = data.artifact;
              setDocumentationArtifact(data.artifact);
              setArtifactAiSuggested(true);
            }
          }
        } catch {
          // Classifier failure is non-fatal; fall through to manual-selection error below.
        } finally {
          setClassifyingArtifact(false);
        }
      }

      if (!artifactToUse) {
        toast.error("Please select a documentation artifact first");
        return;
      }

      if (showVersionDialog && !versionAction) {
        toast.error("Please choose how to handle the existing evidence");
        return;
      }

      setUploading(true);
      setUploadResult(null);
      setUploadOnlyResult(null);

      const fileTypeDescription = getFileTypeDescription(file);
      setProcessingStage(`Preparing ${fileTypeDescription} for upload...`);

      let activeSessionId = sessionId;

      try {
        if (!activeSessionId) {
          activeSessionId = await startSession("Evidence upload and assessment");
        }

        if (!activeSessionId) {
          throw new Error("Unable to start progress tracking session");
        }

        const workflowClient = createSmartEvidenceWorkflowClient(activeSessionId);
        const { extract, upload } = await workflowClient.runUploadWorkflow({
          file,
          evidenceType,
          description,
          documentationArtifact: artifactToUse,
          versionAction,
          existingEvidence:
            versionAction === "replace" && existingEvidence
              ? { id: existingEvidence.id, version: existingEvidence.version }
              : null,
        });

        setFileContent(extract.content);
        setImageData(extract.imageData || null);
        setUploadOnlyResult(upload);

        toast.success(
          `Evidence uploaded successfully! Found ${upload.discovered_controls?.length || 0} relevant controls.`
        );
      } catch (error) {
        console.error("Error uploading evidence:", error);
        reportError(error instanceof Error ? error.message : "Failed to upload evidence");
        toast.error(error instanceof Error ? error.message : "Failed to upload evidence");
      } finally {
        setUploading(false);
        setProcessingStage("");
      }
    },
    [
      description,
      documentationArtifact,
      evidenceType,
      existingEvidence,
      getFileTypeDescription,
      reportError,
      sessionId,
      showVersionDialog,
      startSession,
      versionAction,
    ]
  );

  const startAssessment = useCallback(async () => {
    if (!uploadOnlyResult || !fileContent) {
      toast.error("No uploaded evidence found to assess");
      return;
    }

    setLiveAssessmentProgress(
      createInitialAssessmentProgress(uploadOnlyResult.discovered_controls.length)
    );
    setAssessing(true);

    try {
      setProcessingStage("Running AI assessment...");

      let activeSessionId = sessionId;
      if (!activeSessionId) {
        activeSessionId = await startSession("Evidence assessment");
      }

      if (!activeSessionId) {
        throw new Error("Unable to connect to progress tracking for assessment");
      }

      const workflowClient = createSmartEvidenceWorkflowClient(activeSessionId);
      const assessmentResult: AssessmentWorkflowResponse =
        await workflowClient.runAssessmentWorkflow({
          evidenceIds: uploadOnlyResult.evidence_records.map((e) => e.id),
          fileContent,
          imageData,
        });

      const finalResult: SmartUploadResult = {
        evidence: uploadOnlyResult.evidence,
        discovered_controls: uploadOnlyResult.discovered_controls,
        assessments: assessmentResult.assessments || [],
        documentation_artifact: uploadOnlyResult.documentation_artifact,
      };

      setPendingAssessmentResult(finalResult);
      setShowReviewDialog(true);
      const failed = assessmentResult.failed_controls || [];
      setFailedControls(failed);
      if (failed.length > 0) {
        toast.warning(
          `Assessment finished with warnings: ${assessmentResult.assessed_controls}/${assessmentResult.requested_controls || uploadOnlyResult.discovered_controls.length} controls assessed. Review details before finalizing.`
        );
      } else {
        toast.success(`Assessment completed! Please review the AI analysis before finalizing.`);
      }
    } catch (error) {
      console.error("Error running assessment:", error);
      reportError(error instanceof Error ? error.message : "Failed to run assessment");
      toast.error(error instanceof Error ? error.message : "Failed to run assessment");
    } finally {
      setAssessing(false);
      setProcessingStage("");
    }
  }, [fileContent, imageData, reportError, sessionId, startSession, uploadOnlyResult]);

  const retryFailedControls = useCallback(async () => {
    if (!uploadOnlyResult || !fileContent || failedControls.length === 0) return;

    setRetrying(true);
    try {
      const failedControlIds = new Set(failedControls.map((fc) => fc.control_id));
      const failedEvidenceIds = uploadOnlyResult.evidence_records
        .filter((e) => failedControlIds.has(e.scf_control_id))
        .map((e) => e.id);

      if (failedEvidenceIds.length === 0) return;

      let activeSessionId = sessionId;
      if (!activeSessionId) {
        activeSessionId = await startSession("Retry failed assessments");
      }
      if (!activeSessionId) {
        throw new Error("Unable to start progress tracking for retry");
      }

      const workflowClient = createSmartEvidenceWorkflowClient(activeSessionId);
      const retryResult = await workflowClient.runAssessmentWorkflow({
        evidenceIds: failedEvidenceIds,
        fileContent,
        imageData,
      });

      // Merge retry results with existing pending result
      if (pendingAssessmentResult) {
        const existingAssessments = pendingAssessmentResult.assessments.filter(
          (a) => !failedControlIds.has(a.scf_control_id)
        );
        const mergedResult: SmartUploadResult = {
          ...pendingAssessmentResult,
          assessments: [...existingAssessments, ...(retryResult.assessments || [])],
        };
        setPendingAssessmentResult(mergedResult);
      }

      const stillFailed = retryResult.failed_controls || [];
      setFailedControls(stillFailed);

      if (stillFailed.length === 0) {
        toast.success("All failed controls assessed successfully on retry!");
      } else {
        toast.warning(
          `${failedControls.length - stillFailed.length} control(s) recovered, ${stillFailed.length} still failing.`
        );
      }
    } catch (error) {
      console.error("Error retrying failed controls:", error);
      toast.error(error instanceof Error ? error.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }, [
    failedControls,
    fileContent,
    imageData,
    pendingAssessmentResult,
    sessionId,
    startSession,
    uploadOnlyResult,
  ]);

  const handleApproveAssessment = useCallback(async () => {
    if (!pendingAssessmentResult) return;

    try {
      const response = await fetch(`/api/evidence/${pendingAssessmentResult.evidence.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewed_at: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setUploadResult(pendingAssessmentResult);
        setPendingAssessmentResult(null);

        if (onEvidenceProcessed) {
          onEvidenceProcessed(pendingAssessmentResult);
        }

        await endSession();
        toast.success("Assessment approved and saved successfully!");
      } else {
        throw new Error("Failed to approve assessment");
      }
    } catch (error) {
      console.error("Error approving assessment:", error);
      toast.error("Failed to approve assessment");
    }
  }, [endSession, onEvidenceProcessed, pendingAssessmentResult]);

  const handleRejectAssessment = useCallback(
    async (rejectionReason: string) => {
      if (!pendingAssessmentResult) {
        throw new Error("No assessment result to reject");
      }

      const response = await fetch(`/api/evidence/${pendingAssessmentResult.evidence.id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rejection_reason: rejectionReason,
          reviewed_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject assessment");
      }

      setPendingAssessmentResult(null);
      setShowReviewDialog(false);
      await endSession();
    },
    [endSession, pendingAssessmentResult]
  );

  const dropzone = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/gif": [".gif"],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
  });

  const graphExtractionLimited =
    uploadOnlyResult?.graph_extraction?.quality === "limited" ||
    uploadOnlyResult?.graph_mapping?.mapping_skipped === true;
  const graphExtractionSkipReason =
    uploadOnlyResult?.graph_mapping?.skip_reason ||
    uploadOnlyResult?.graph_extraction?.limited_reason ||
    null;

  // Determine which view to render
  const showUploadForm = !uploadResult && !uploadOnlyResult && !pendingAssessmentResult;
  const showAssessmentProgress = uploadOnlyResult && !uploadResult && !pendingAssessmentResult;
  const showResults = uploadResult && !pendingAssessmentResult;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) resetDialog();
      }}
    >
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button data-testid="open-smart-upload-button" aria-controls={SMART_UPLOAD_DIALOG_ID}>
            <FileUp className="mr-2 h-4 w-4" />
            Upload Evidence
          </Button>
        </DialogTrigger>
      )}
      <TooltipProvider delayDuration={0}>
        <DialogContent
          id={SMART_UPLOAD_DIALOG_ID}
          className="max-h-[90vh] max-w-3xl overflow-y-auto"
          data-testid="smart-upload-dialog"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const artifactTrigger = document.getElementById("documentation-artifact");
            if (artifactTrigger instanceof HTMLElement) {
              artifactTrigger.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="smart-upload-title">
              {dialogTitle ?? "Upload evidence"}
            </DialogTitle>
            <DialogDescription>
              Select the document you&apos;re providing, then Graphletter will assess the controls
              it applies to.
            </DialogDescription>
          </DialogHeader>

          {showUploadForm && (
            <UploadForm
              artifacts={artifacts}
              loadingArtifacts={loadingArtifacts}
              documentationArtifact={documentationArtifact}
              onDocumentationArtifactChange={(value) => {
                setArtifactAiSuggested(false);
                setDocumentationArtifact(value);
              }}
              artifactAiSuggested={artifactAiSuggested}
              classifyingArtifact={classifyingArtifact}
              artifactComboboxOpen={artifactComboboxOpen}
              onArtifactComboboxOpenChange={setArtifactComboboxOpen}
              selectedArtifactControls={selectedArtifactControls}
              showVersionDialog={showVersionDialog}
              existingEvidence={existingEvidence}
              versionAction={versionAction}
              onVersionActionChange={setVersionAction}
              onVersionDialogCancel={() => {
                setShowVersionDialog(false);
                setVersionAction(null);
              }}
              onVersionDialogContinue={() => setShowVersionDialog(false)}
              evidenceType={evidenceType}
              onEvidenceTypeChange={setEvidenceType}
              description={description}
              onDescriptionChange={setDescription}
              dropzone={dropzone}
              uploading={uploading}
              processingStage={processingStage}
            />
          )}

          {showAssessmentProgress && (
            <AssessmentProgressView
              uploadOnlyResult={uploadOnlyResult}
              assessing={assessing}
              liveAssessmentProgress={liveAssessmentProgress}
              processingStage={processingStage}
              graphExtractionLimited={graphExtractionLimited}
              graphExtractionSkipReason={graphExtractionSkipReason}
              failedControls={failedControls}
              retrying={retrying}
              onStartAssessment={startAssessment}
              onRetryFailed={retryFailedControls}
              onUploadDifferentFile={() => setUploadOnlyResult(null)}
              onClose={() => setIsOpen(false)}
            />
          )}

          {pendingAssessmentResult ? null : null}

          {showResults && (
            <UploadResultsView
              uploadResult={uploadResult}
              onStartUploadForArtifact={(artifactName) => {
                setUploadResult(null);
                setUploadOnlyResult(null);
                setDocumentationArtifact(artifactName);
              }}
              onClose={() => setIsOpen(false)}
            />
          )}

          {/* Assessment Review Dialog */}
          <AssessmentReviewDialog
            isOpen={showReviewDialog}
            onClose={() => setShowReviewDialog(false)}
            result={
              pendingAssessmentResult
                ? {
                    assessments: pendingAssessmentResult.assessments,
                    source: {
                      type: "evidence",
                      name: pendingAssessmentResult.evidence.file_name,
                      id: pendingAssessmentResult.evidence.id,
                    },
                  }
                : null
            }
            onApprove={handleApproveAssessment}
            onReject={handleRejectAssessment}
            controlIds={pendingAssessmentResult?.discovered_controls}
          />
        </DialogContent>
      </TooltipProvider>
    </Dialog>
  );
}
