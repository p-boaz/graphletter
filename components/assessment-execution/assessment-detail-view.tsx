"use client";

import { FileText, Plus, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { UserAssessment } from "@/lib/types/assessment";
import { getResultColor, getStatusColor } from "./utils";

interface AssessmentDetailViewProps {
  assessment: UserAssessment;
  onUpdate: (id: string, updates: Partial<UserAssessment>) => void;
}

export function AssessmentDetailView({ assessment, onUpdate }: AssessmentDetailViewProps) {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    assessment_result: assessment.assessment_result || "",
    confidence_level: assessment.confidence_level || "medium",
    implementation_status: assessment.implementation_status || "not_implemented",
    assessment_summary: assessment.assessment_summary || "",
    assessment_notes: assessment.assessment_notes || "",
    deficiencies_identified: assessment.deficiencies_identified || [],
    recommendations: assessment.recommendations || [],
    risk_rating: assessment.risk_rating || "",
    business_impact: assessment.business_impact || "",
    remediation_timeline: assessment.remediation_timeline || "",
  });

  const handleSave = () => {
    onUpdate(assessment.id, formData);
    setEditMode(false);
  };

  const addDeficiency = () => {
    setFormData((prev) => ({
      ...prev,
      deficiencies_identified: [...prev.deficiencies_identified, ""],
    }));
  };

  const updateDeficiency = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      deficiencies_identified: prev.deficiencies_identified.map((item, i) =>
        i === index ? value : item
      ),
    }));
  };

  const removeDeficiency = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      deficiencies_identified: prev.deficiencies_identified.filter((_, i) => i !== index),
    }));
  };

  const addRecommendation = () => {
    setFormData((prev) => ({
      ...prev,
      recommendations: [...prev.recommendations, ""],
    }));
  };

  const updateRecommendation = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      recommendations: prev.recommendations.map((item, i) => (i === index ? value : item)),
    }));
  };

  const removeRecommendation = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      recommendations: prev.recommendations.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="execution">Execution</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="font-medium">Control ID</Label>
              <div className="text-slate-600">{assessment.scf_control_id}</div>
            </div>
            <div>
              <Label className="font-medium">Assessment Type</Label>
              <div className="text-slate-600 capitalize">{assessment.assessment_type}</div>
            </div>
            {assessment.scf_ao_id && (
              <div>
                <Label className="font-medium">Objective ID</Label>
                <div className="text-slate-600">{assessment.scf_ao_id}</div>
              </div>
            )}
            <div>
              <Label className="font-medium">Frequency</Label>
              <div className="text-slate-600 capitalize">{assessment.assessment_frequency}</div>
            </div>
          </div>

          {assessment.scf_control && (
            <div>
              <Label className="font-medium">Control Description</Label>
              <div className="mt-1 text-slate-600 text-sm">
                {assessment.scf_control.description}
              </div>
            </div>
          )}

          {assessment.assessment_objective && (
            <div>
              <Label className="font-medium">Assessment Objective</Label>
              <div className="mt-1 text-slate-600 text-sm">
                {assessment.assessment_objective.assessment_objective}
              </div>

              {assessment.assessment_objective.assessment_procedure && (
                <>
                  <Label className="mt-3 block font-medium">Assessment Procedure</Label>
                  <div className="mt-1 text-slate-600 text-sm">
                    {assessment.assessment_objective.assessment_procedure}
                  </div>
                </>
              )}

              {assessment.assessment_objective.expected_results && (
                <>
                  <Label className="mt-3 block font-medium">Expected Results</Label>
                  <div className="mt-1 text-slate-600 text-sm">
                    {assessment.assessment_objective.expected_results}
                  </div>
                </>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="execution" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-lg">Assessment Execution</h3>
            <Button variant="outline" size="sm" onClick={() => setEditMode(!editMode)}>
              {editMode ? "Cancel" : "Edit"}
            </Button>
          </div>

          {editMode ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="result">Assessment Result</Label>
                  <Select
                    value={formData.assessment_result}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        assessment_result: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select result" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="met">Met</SelectItem>
                      <SelectItem value="partially_met">Partially Met</SelectItem>
                      <SelectItem value="not_met">Not Met</SelectItem>
                      <SelectItem value="not_tested">Not Tested</SelectItem>
                      <SelectItem value="not_applicable">Not Applicable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="confidence">Confidence Level</Label>
                  <Select
                    value={formData.confidence_level}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        confidence_level: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="implementation">Implementation Status</Label>
                  <Select
                    value={formData.implementation_status}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        implementation_status: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_implemented">Not Implemented</SelectItem>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="implemented">Implemented</SelectItem>
                      <SelectItem value="needs_review">Needs Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="risk">Risk Rating</Label>
                  <Select
                    value={formData.risk_rating}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, risk_rating: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select risk level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="summary">Assessment Summary</Label>
                <Textarea
                  id="summary"
                  value={formData.assessment_summary}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      assessment_summary: e.target.value,
                    }))
                  }
                  placeholder="Provide a summary of the assessment..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="notes">Assessment Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.assessment_notes}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      assessment_notes: e.target.value,
                    }))
                  }
                  placeholder="Detailed assessment notes..."
                  rows={4}
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Deficiencies Identified</Label>
                  <Button size="sm" variant="outline" onClick={addDeficiency}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Deficiency
                  </Button>
                </div>
                {formData.deficiencies_identified.map((deficiency, index) => (
                  <div key={index} className="mb-2 flex gap-2">
                    <Textarea
                      value={deficiency}
                      onChange={(e) => updateDeficiency(index, e.target.value)}
                      placeholder={`Deficiency ${index + 1}...`}
                      rows={2}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeDeficiency(index)}
                      className="text-red-600"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Recommendations</Label>
                  <Button size="sm" variant="outline" onClick={addRecommendation}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Recommendation
                  </Button>
                </div>
                {formData.recommendations.map((recommendation, index) => (
                  <div key={index} className="mb-2 flex gap-2">
                    <Textarea
                      value={recommendation}
                      onChange={(e) => updateRecommendation(index, e.target.value)}
                      placeholder={`Recommendation ${index + 1}...`}
                      rows={2}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeRecommendation(index)}
                      className="text-red-600"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="business-impact">Business Impact</Label>
                  <Textarea
                    id="business-impact"
                    value={formData.business_impact}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        business_impact: e.target.value,
                      }))
                    }
                    placeholder="Describe business impact if control fails..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="remediation">Remediation Timeline</Label>
                  <Textarea
                    id="remediation"
                    value={formData.remediation_timeline}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        remediation_timeline: e.target.value,
                      }))
                    }
                    placeholder="Expected timeline for remediation..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save Changes</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="font-medium">Result</Label>
                  <div className="text-slate-600">
                    {assessment.assessment_result ? (
                      <Badge className={getResultColor(assessment.assessment_result)}>
                        {assessment.assessment_result.replace("_", " ")}
                      </Badge>
                    ) : (
                      "Not assessed"
                    )}
                  </div>
                </div>
                <div>
                  <Label className="font-medium">Confidence</Label>
                  <div className="text-slate-600 capitalize">
                    {assessment.confidence_level || "Not set"}
                  </div>
                </div>
                <div>
                  <Label className="font-medium">Implementation</Label>
                  <div className="text-slate-600 capitalize">
                    {assessment.implementation_status.replace("_", " ")}
                  </div>
                </div>
                <div>
                  <Label className="font-medium">Risk Rating</Label>
                  <div className="text-slate-600 capitalize">
                    {assessment.risk_rating || "Not rated"}
                  </div>
                </div>
              </div>

              {assessment.assessment_summary && (
                <div>
                  <Label className="font-medium">Summary</Label>
                  <div className="mt-1 text-slate-600 text-sm">{assessment.assessment_summary}</div>
                </div>
              )}

              {assessment.assessment_notes && (
                <div>
                  <Label className="font-medium">Notes</Label>
                  <div className="mt-1 whitespace-pre-wrap text-slate-600 text-sm">
                    {assessment.assessment_notes}
                  </div>
                </div>
              )}

              {assessment.deficiencies_identified &&
                assessment.deficiencies_identified.length > 0 && (
                  <div>
                    <Label className="font-medium">Deficiencies</Label>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-slate-600 text-sm">
                      {assessment.deficiencies_identified.map((deficiency, index) => (
                        <li key={index}>{deficiency}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {assessment.recommendations && assessment.recommendations.length > 0 && (
                <div>
                  <Label className="font-medium">Recommendations</Label>
                  <ul className="mt-1 list-inside list-disc space-y-1 text-slate-600 text-sm">
                    {assessment.recommendations.map((recommendation, index) => (
                      <li key={index}>{recommendation}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="evidence" className="space-y-4">
          <div>
            <Label className="font-medium">Linked Evidence</Label>
            {assessment.evidence ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-600" />
                    <span className="font-medium text-sm">{assessment.evidence.file_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {assessment.evidence.evidence_type}
                    </Badge>
                    <Badge
                      className={`text-xs ${getStatusColor(assessment.evidence.evidence_status)}`}
                    >
                      {assessment.evidence.evidence_status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500">
                <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm">No evidence linked to this assessment</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
