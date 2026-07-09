"use client";

import { Check, ChevronsUpDown, FileSearch, FileUp } from "lucide-react";
import type { DropzoneState } from "react-dropzone";
import { InlineHelp } from "@/components/inline-help";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FieldHelpTooltip } from "./field-help-tooltip";
import { ImpactPreviewBanner } from "./impact-preview-banner";
import type { DocumentationArtifact, ExistingEvidence } from "./types";
import { pluralize } from "./utils";
import { VersionDialog } from "./version-dialog";

interface UploadFormProps {
  // Artifact state
  artifacts: DocumentationArtifact[];
  loadingArtifacts: boolean;
  documentationArtifact: string;
  onDocumentationArtifactChange: (value: string) => void;
  artifactAiSuggested: boolean;
  classifyingArtifact: boolean;
  artifactComboboxOpen: boolean;
  onArtifactComboboxOpenChange: (open: boolean) => void;
  selectedArtifactControls: string[];

  // Version state
  showVersionDialog: boolean;
  existingEvidence: ExistingEvidence | null;
  versionAction: "replace" | "keep_both" | null;
  onVersionActionChange: (action: "replace" | "keep_both") => void;
  onVersionDialogCancel: () => void;
  onVersionDialogContinue: () => void;

  // Form state
  evidenceType: string;
  onEvidenceTypeChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;

  // Dropzone
  dropzone: DropzoneState;
  uploading: boolean;
  processingStage: string;
}

export function UploadForm({
  artifacts,
  loadingArtifacts,
  documentationArtifact,
  onDocumentationArtifactChange,
  artifactAiSuggested,
  classifyingArtifact,
  artifactComboboxOpen,
  onArtifactComboboxOpenChange,
  selectedArtifactControls,
  showVersionDialog,
  existingEvidence,
  versionAction,
  onVersionActionChange,
  onVersionDialogCancel,
  onVersionDialogContinue,
  evidenceType,
  onEvidenceTypeChange,
  description,
  onDescriptionChange,
  dropzone,
  uploading,
  processingStage,
}: UploadFormProps) {
  const { getRootProps, getInputProps, isDragActive } = dropzone;
  const uploadDisabled = uploading || (showVersionDialog && !versionAction);
  const groupedArtifacts = artifacts.reduce(
    (groups, artifact) => {
      const firstControl = artifact.controls[0]?.scf_control_id || "Other";
      const groupName = firstControl.includes("-") ? firstControl.split("-")[0] : "Other";
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(artifact);
      return groups;
    },
    {} as Record<string, DocumentationArtifact[]>
  );
  const recommendedArtifacts = [...artifacts]
    .sort((a, b) => b.controls.length - a.controls.length || a.artifact.localeCompare(b.artifact))
    .slice(0, 5);
  const recommendedArtifactNames = new Set(
    recommendedArtifacts.map((artifact) => artifact.artifact)
  );
  const selectArtifact = (artifactName: string) => {
    onDocumentationArtifactChange(artifactName);
    onArtifactComboboxOpenChange(false);
  };

  return (
    <div className="space-y-6">
      {/* Evidence Details */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="documentation-artifact">Documentation Artifact</Label>
            <FieldHelpTooltip
              label="Documentation Artifact"
              text="The type of compliance document you're providing, such as a policy, procedure, or configuration. This determines which controls from the Secure Controls Framework (SCF) will be assessed against your evidence."
            />
          </div>
          <p className="text-xs text-slate-500">
            Not sure which artifact to choose?{" "}
            <InlineHelp termId="artifacts-and-controls" testId="artifact-mapping-link">
              See how artifacts map to controls
            </InlineHelp>
            .
          </p>
          <Popover open={artifactComboboxOpen} onOpenChange={onArtifactComboboxOpenChange}>
            <PopoverTrigger asChild>
              <Button
                id="documentation-artifact"
                data-testid="documentation-artifact-combobox"
                type="button"
                variant="outline"
                role="combobox"
                disabled={loadingArtifacts}
                aria-expanded={artifactComboboxOpen}
                aria-label="Select documentation artifact"
                className="w-full justify-between font-normal"
              >
                <span className={cn("truncate", !documentationArtifact && "text-muted-foreground")}>
                  {loadingArtifacts
                    ? "Loading artifacts..."
                    : documentationArtifact || "Select documentation artifact"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command
                filter={(value, search) =>
                  value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                }
              >
                <CommandInput placeholder="Search artifacts..." />
                <CommandList
                  onWheel={(e) => {
                    e.currentTarget.scrollTop += e.deltaY;
                  }}
                >
                  <CommandEmpty>
                    {artifacts.length === 0 ? "No artifacts available" : "No artifacts found."}
                  </CommandEmpty>
                  {recommendedArtifacts.length > 0 && (
                    <CommandGroup heading="Recommended for you">
                      {recommendedArtifacts.map((artifact) => (
                        <CommandItem
                          key={`recommended_${artifact.erl_id || "unknown"}_${artifact.artifact}`}
                          value={artifact.artifact}
                          aria-label={artifact.artifact}
                          onClick={() => selectArtifact(artifact.artifact)}
                          onSelect={() => selectArtifact(artifact.artifact)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              documentationArtifact === artifact.artifact
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate">{artifact.artifact}</span>
                          <span className="ml-2 shrink-0 text-muted-foreground text-xs">
                            {pluralize(artifact.controls.length, "control")}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {Object.entries(groupedArtifacts)
                    .map(
                      ([groupName, groupArtifacts]) =>
                        [
                          groupName,
                          groupArtifacts.filter(
                            (artifact) => !recommendedArtifactNames.has(artifact.artifact)
                          ),
                        ] as const
                    )
                    .filter(([, groupArtifacts]) => groupArtifacts.length > 0)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([groupName, groupArtifacts]) => (
                      <CommandGroup key={groupName} heading={groupName}>
                        {groupArtifacts
                          .sort((a, b) => a.artifact.localeCompare(b.artifact))
                          .map((artifact) => (
                            <CommandItem
                              key={`${artifact.erl_id || "unknown"}_${artifact.artifact}`}
                              value={artifact.artifact}
                              aria-label={artifact.artifact}
                              onClick={() => selectArtifact(artifact.artifact)}
                              onSelect={() => selectArtifact(artifact.artifact)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  documentationArtifact === artifact.artifact
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <span className="truncate">{artifact.artifact}</span>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {classifyingArtifact && (
            <p
              className="flex items-center gap-1.5 text-slate-600 text-xs"
              data-testid="artifact-classifying"
            >
              <FileSearch className="h-3 w-3 animate-pulse text-slate-600" />
              <span>Analyzing filename to suggest an artifact…</span>
            </p>
          )}
          {artifactAiSuggested && !classifyingArtifact && documentationArtifact && (
            <p
              className="flex items-center gap-1.5 text-slate-600 text-xs"
              data-testid="artifact-ai-suggested"
            >
              <FileSearch className="h-3 w-3 text-slate-600" />
              <span>Suggested from filename. Use the picker above to change.</span>
            </p>
          )}
          {!loadingArtifacts && artifacts.length === 0 && (
            <p className="text-amber-700 text-xs">
              No document types are available yet. Contact support if this persists.
            </p>
          )}
          {selectedArtifactControls.length > 0 && (
            <div className="text-gray-600 text-xs">
              <p className="mb-1 font-medium">Will assess controls:</p>
              <div className="flex flex-wrap gap-1">
                {selectedArtifactControls.map((controlId) => (
                  <Badge key={controlId} variant="outline" className="text-xs">
                    {controlId}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Impact Preview Banner */}
        {selectedArtifactControls.length > 0 && (
          <ImpactPreviewBanner controlIds={selectedArtifactControls} />
        )}

        {/* Version Dialog */}
        {showVersionDialog && existingEvidence && (
          <VersionDialog
            existingEvidence={existingEvidence}
            documentationArtifact={documentationArtifact}
            versionAction={versionAction}
            onVersionActionChange={onVersionActionChange}
            onCancel={onVersionDialogCancel}
            onContinue={onVersionDialogContinue}
          />
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="evidence-type">Evidence Type</Label>
            <FieldHelpTooltip
              label="Evidence Type"
              text="The format or category of your document. This helps the AI evaluate the content appropriately, since a policy document is assessed differently than a configuration screenshot."
            />
          </div>
          <Select value={evidenceType} onValueChange={onEvidenceTypeChange}>
            <SelectTrigger data-testid="evidence-type-select-trigger">
              <SelectValue placeholder="Select evidence type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="policy">Policy Document</SelectItem>
              <SelectItem value="procedure">Procedure/Process</SelectItem>
              <SelectItem value="document">General Document</SelectItem>
              <SelectItem value="screenshot">Screenshot/Image</SelectItem>
              <SelectItem value="log">Log File/Report</SelectItem>
              <SelectItem value="certificate">Certificate</SelectItem>
              <SelectItem value="configuration">Configuration File</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Additional Details (Optional)</Label>
          <Textarea
            id="description"
            placeholder="Any additional context about this evidence..."
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      {/* File Upload */}
      <div
        {...getRootProps({
          role: "button",
          "aria-label": "Upload evidence file",
          "aria-describedby": "evidence-upload-help",
          "aria-disabled": uploadDisabled,
          tabIndex: uploadDisabled ? -1 : 0,
        })}
        className={cn(
          "cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
          isDragActive ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400",
          uploadDisabled ? "cursor-not-allowed opacity-50" : ""
        )}
      >
        <p id="evidence-upload-help" className="sr-only">
          Accepted evidence file types are PDF, Word, Excel, image, text, and CSV files up to 50MB.
        </p>
        <input
          {...getInputProps()}
          data-testid="document-upload-input"
          aria-label="Evidence file"
          disabled={showVersionDialog && !versionAction}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className="font-medium text-gray-600 text-sm">{processingStage}</span>
            <span className="text-gray-500 text-xs">This may take a few moments</span>
          </div>
        ) : showVersionDialog && !versionAction ? (
          <div className="flex flex-col items-center gap-2">
            <FileUp className="h-8 w-8 text-gray-400" />
            <div className="text-gray-600 text-sm">
              <p>Please choose how to handle existing evidence first</p>
              <p className="mt-1 text-gray-500 text-xs">Select an option above to continue</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <FileUp className="h-8 w-8 text-gray-400" />
            <div className="text-gray-600 text-sm">
              {isDragActive ? (
                <p>Drop evidence file here</p>
              ) : (
                <div>
                  <p>Click to upload or drag and drop</p>
                  <p className="mt-1 text-gray-500 text-xs">
                    PDF, Word, Excel, images (OCR), text files (max 50MB)
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="rounded-lg bg-gray-50 p-4">
        <h4 className="mb-2 font-medium text-gray-900">How this works:</h4>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <div className="flex items-start gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 font-medium text-white text-xs">
              1
            </div>
            <div>
              <p className="font-medium text-gray-900">Select Document Type</p>
              <p className="text-gray-600">Choose the type of document you&apos;re uploading</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 font-medium text-white text-xs">
              2
            </div>
            <div>
              <p className="font-medium text-gray-900">Upload Evidence</p>
              <p className="text-gray-600">Your document type tells us which controls to check</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 font-medium text-white text-xs">
              3
            </div>
            <div>
              <p className="font-medium text-gray-900">Assessment</p>
              <p className="text-gray-600">Evaluates evidence against all relevant objectives</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
