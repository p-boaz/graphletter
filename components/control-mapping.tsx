"use client";

import { AlertTriangle, ArrowRight, Brain, Loader2, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function ControlMapping() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(true); // Set to true for demo

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);

    try {
      // Test with real AI analysis
      const response = await fetch("/api/ai/control-mapping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceControl: {
            id: "ISO-81001-5.1",
            title: "Health software safety classification",
            description:
              "The manufacturer shall establish and document a health software safety classification system...",
            standard: "ISO-IEC 81001",
          },
          targetControl: {
            id: "NIST-PO.1.1",
            title: "Identify and document software security requirements",
            description: "Identify and document all security requirements for the software...",
            standard: "NIST SP 800-218",
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log("AI Analysis Result:", result.data);
        // Update the mappings with real AI results
        setAnalysisComplete(true);
      } else {
        console.error("AI Analysis failed:", result.error);
      }
    } catch (error) {
      console.error("Error calling AI analysis:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const mappings = [
    {
      id: "1",
      sourceControl: {
        id: "ISO-81001-5.1",
        title: "Health software safety classification",
        description:
          "The manufacturer shall establish and document a health software safety classification system...",
        standard: "ISO-IEC 81001",
      },
      targetControl: {
        id: "NIST-PO.1.1",
        title: "Identify and document software security requirements",
        description: "Identify and document all security requirements for the software...",
        standard: "NIST SP 800-218",
      },
      mappingType: "partial",
      confidence: 78,
      aiAnalysis:
        "Both controls focus on establishing systematic approaches to software safety/security requirements, but ISO-81001 is health-specific while NIST is general software security.",
      gaps: [
        "Health-specific risk assessment not covered in NIST",
        "Medical device regulatory requirements missing",
      ],
    },
    {
      id: "2",
      sourceControl: {
        id: "ISO-81001-5.2",
        title: "Health software safety risk management",
        description:
          "The manufacturer shall establish, document, implement and maintain a risk management process...",
        standard: "ISO-IEC 81001",
      },
      targetControl: {
        id: "NIST-PO.2.1",
        title: "Implement threat modeling",
        description: "Create and maintain threat models for the software...",
        standard: "NIST SP 800-218",
      },
      mappingType: "related",
      confidence: 65,
      aiAnalysis:
        "Both address risk assessment but from different perspectives - ISO focuses on health safety risks while NIST focuses on security threats.",
      gaps: [
        "Clinical risk assessment methodology not addressed",
        "Patient safety considerations missing",
      ],
    },
    {
      id: "3",
      sourceControl: {
        id: "ISO-81001-6.1",
        title: "Health software lifecycle processes",
        description:
          "The manufacturer shall establish and maintain health software lifecycle processes...",
        standard: "ISO-IEC 81001",
      },
      targetControl: {
        id: "NIST-PS.1.1",
        title: "Protect all forms of code from unauthorized access",
        description: "Implement access controls and code protection mechanisms...",
        standard: "NIST SP 800-218",
      },
      mappingType: "direct",
      confidence: 92,
      aiAnalysis:
        "Strong alignment on secure development lifecycle practices. Both emphasize controlled development processes with proper access management.",
      gaps: [],
    },
  ];

  const getMappingBadge = (type: string) => {
    switch (type) {
      case "direct":
        return (
          <Badge className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-body font-medium text-emerald-700">
            <div className="mr-2 h-2 w-2 rounded-full bg-emerald-500"></div>
            Direct Match
          </Badge>
        );
      case "partial":
        return (
          <Badge className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-body font-medium text-amber-700">
            <div className="mr-2 h-2 w-2 rounded-full bg-amber-500"></div>
            Partial Match
          </Badge>
        );
      case "related":
        return (
          <Badge className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-body font-medium text-blue-700">
            <div className="mr-2 h-2 w-2 rounded-full bg-blue-500"></div>
            Related
          </Badge>
        );
      default:
        return <Badge variant="secondary">No Match</Badge>;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-emerald-600";
    if (confidence >= 60) return "text-amber-600";
    return "text-red-500";
  };

  return (
    <div className="space-y-8">
      {/* Elegant Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="font-display font-semibold text-3xl text-slate-900">Control Mapping</h2>
          <p className="font-body font-light text-lg text-slate-600">
            AI-powered intelligent mapping between ISO-IEC 81001 and NIST SP 800-218
          </p>
        </div>
        <Button
          onClick={handleAIAnalysis}
          disabled={isAnalyzing}
          className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-body font-medium text-white shadow-elegant transition-all duration-200 hover:scale-105 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Run AI Analysis
            </>
          )}
        </Button>
      </div>

      {!analysisComplete && !isAnalyzing && (
        <Card className="relative overflow-hidden border-2 border-slate-300 border-dashed bg-gradient-to-br from-slate-50 to-white shadow-elegant">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5"></div>
          <CardContent className="relative flex flex-col items-center justify-center py-16">
            <div className="mb-6 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 p-4">
              <Brain className="h-12 w-12 text-blue-600" />
            </div>
            <h3 className="mb-3 font-display font-semibold text-2xl text-slate-900">
              AI Analysis Required
            </h3>
            <p className="mb-6 max-w-md text-center font-body text-slate-600">
              Run intelligent AI analysis to map controls between ISO-IEC 81001 and NIST SP 800-218
            </p>
            <Button
              onClick={handleAIAnalysis}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-3 font-body font-medium text-white transition-all duration-200 hover:scale-105 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg"
            >
              <Zap className="mr-2 h-4 w-4" />
              Start Analysis
            </Button>
          </CardContent>
        </Card>
      )}

      {analysisComplete && (
        <div className="animate-fade-in space-y-8">
          {/* Results Summary */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-purple-50 shadow-elegant">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10"></div>
            <CardHeader className="relative border-slate-100/60 border-b p-8">
              <CardTitle className="flex items-center space-x-3 font-display text-2xl text-slate-900">
                <div className="rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 p-2">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <span>AI Mapping Results</span>
              </CardTitle>
              <CardDescription className="font-body text-base text-slate-600">
                Analysis complete. Found {mappings.length} control mappings with varying confidence
                levels.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative p-8">
              <div className="grid grid-cols-3 gap-8 text-center">
                <div className="space-y-2">
                  <div className="font-display font-semibold text-3xl text-emerald-600">1</div>
                  <div className="font-body text-slate-600 text-sm">Direct Matches</div>
                </div>
                <div className="space-y-2">
                  <div className="font-display font-semibold text-3xl text-amber-600">1</div>
                  <div className="font-body text-slate-600 text-sm">Partial Matches</div>
                </div>
                <div className="space-y-2">
                  <div className="font-display font-semibold text-3xl text-blue-600">1</div>
                  <div className="font-body text-slate-600 text-sm">Related Controls</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mapping Details */}
          <div className="space-y-8">
            {mappings.map((mapping, index) => (
              <Card
                key={mapping.id}
                className="group relative animate-slide-up overflow-hidden border-0 bg-white/80 shadow-elegant backdrop-blur-sm transition-all duration-300 hover:scale-[1.01] hover:shadow-elegant-lg"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-slate-200/30 via-transparent to-slate-200/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>

                <CardHeader className="relative border-slate-100/60 border-b bg-gradient-to-r from-slate-50/50 to-white/50 p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {getMappingBadge(mapping.mappingType)}
                      <span
                        className={`font-body font-semibold text-lg ${getConfidenceColor(mapping.confidence)}`}
                      >
                        {mapping.confidence}% confidence
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Progress value={mapping.confidence} className="h-2 w-32" />
                      <div className="font-body text-slate-500 text-sm">AI Score</div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="relative space-y-8 p-8">
                  <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-3">
                    {/* Source Control */}
                    <div className="space-y-4 rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-6">
                      <div className="flex items-center space-x-3">
                        <Badge
                          variant="outline"
                          className="rounded-full border-slate-300 bg-white px-3 py-1 font-body text-slate-700"
                        >
                          {mapping.sourceControl.standard}
                        </Badge>
                        <span className="font-body font-semibold text-slate-900">
                          {mapping.sourceControl.id}
                        </span>
                      </div>
                      <h4 className="font-display font-semibold text-lg text-slate-900">
                        {mapping.sourceControl.title}
                      </h4>
                      <p className="font-body text-slate-600 text-sm leading-relaxed">
                        {mapping.sourceControl.description}
                      </p>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center">
                      <div className="rounded-full bg-gradient-to-r from-blue-100 to-purple-100 p-3">
                        <ArrowRight className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>

                    {/* Target Control */}
                    <div className="space-y-4 rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-6">
                      <div className="flex items-center space-x-3">
                        <Badge
                          variant="outline"
                          className="rounded-full border-slate-300 bg-white px-3 py-1 font-body text-slate-700"
                        >
                          {mapping.targetControl.standard}
                        </Badge>
                        <span className="font-body font-semibold text-slate-900">
                          {mapping.targetControl.id}
                        </span>
                      </div>
                      <h4 className="font-display font-semibold text-lg text-slate-900">
                        {mapping.targetControl.title}
                      </h4>
                      <p className="font-body text-slate-600 text-sm leading-relaxed">
                        {mapping.targetControl.description}
                      </p>
                    </div>
                  </div>

                  {/* AI Analysis */}
                  <div className="relative rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-purple-50 p-6">
                    <div className="flex items-start space-x-4">
                      <div className="rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 p-2">
                        <Brain className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h5 className="mb-3 font-body font-medium text-blue-900 text-sm uppercase tracking-wider">
                          AI Analysis
                        </h5>
                        <p className="font-body text-blue-800 text-sm leading-relaxed">
                          {mapping.aiAnalysis}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Gaps */}
                  {mapping.gaps && mapping.gaps.length > 0 && (
                    <div className="relative rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-orange-50 p-6">
                      <div className="flex items-start space-x-4">
                        <div className="rounded-lg bg-gradient-to-br from-red-500 to-orange-500 p-2">
                          <AlertTriangle className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h5 className="mb-3 font-body font-medium text-red-900">
                            Identified Gaps
                          </h5>
                          <ul className="space-y-2">
                            {mapping.gaps.map((gap, index) => (
                              <li
                                key={index}
                                className="flex items-start space-x-3 font-body text-red-800 text-sm"
                              >
                                <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500"></div>
                                <span>{gap}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
