"use client";

import { AlertCircle, ArrowRight, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FrameworkCrosswalk {
  id: string;
  source_framework: string;
  source_control_id: string;
  target_framework: string;
  target_control_id: string;
  mapping_type: string;
  confidence_score: number;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

const POPULAR_FRAMEWORKS = [
  "ISO 27001",
  "NIST 800-53",
  "SOC 2",
  "NIST Cybersecurity Framework",
  "COBIT",
  "PCI DSS",
  "HIPAA",
  "GDPR",
  "FedRAMP",
  "ISO 27002",
];

export function FrameworkCrosswalk() {
  const [sourceFramework, setSourceFramework] = useState("");
  const [targetFramework, setTargetFramework] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [crosswalkResults, setCrosswalkResults] = useState<FrameworkCrosswalk[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleCrosswalkSearch = async () => {
    if (!sourceFramework || !targetFramework) {
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const response = await fetch("/api/enhanced/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          search_type: "crosswalk",
          query: searchQuery || "framework mapping",
          frameworks: [sourceFramework, targetFramework],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setCrosswalkResults(result.results || []);
      } else {
        console.error("Crosswalk search failed:", response.statusText);
        setCrosswalkResults([]);
      }
    } catch (error) {
      console.error("Error performing crosswalk search:", error);
      setCrosswalkResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "bg-green-100 text-green-800";
    if (confidence >= 0.7) return "bg-ft-cream text-ft-black";
    if (confidence >= 0.5) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getMappingTypeIcon = (type: string) => {
    switch (type) {
      case "equivalent":
        return "=";
      case "partial":
        return "≈";
      case "related":
        return "~";
      case "complementary":
        return "+";
      default:
        return "?";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 font-bold text-2xl text-slate-900">Framework Crosswalk Analysis</h2>
        <p className="text-slate-600">
          Find direct mappings between controls across different compliance frameworks
        </p>
      </div>

      {/* Search Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Configure Crosswalk Search</span>
          </CardTitle>
          <CardDescription>
            Select two frameworks to find control mappings between them
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="source-framework">Source Framework</Label>
              <Select value={sourceFramework} onValueChange={setSourceFramework}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source framework" />
                </SelectTrigger>
                <SelectContent>
                  {POPULAR_FRAMEWORKS.map((framework) => (
                    <SelectItem key={framework} value={framework}>
                      {framework}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-framework">Target Framework</Label>
              <Select value={targetFramework} onValueChange={setTargetFramework}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target framework" />
                </SelectTrigger>
                <SelectContent>
                  {POPULAR_FRAMEWORKS.map((framework) => (
                    <SelectItem key={framework} value={framework}>
                      {framework}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="search-query">
              Optional: Search Focus (e.g., &quot;access control&quot;, &quot;audit logging&quot;)
            </Label>
            <Input
              id="search-query"
              placeholder="Enter specific control area to focus on..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {sourceFramework && targetFramework && (
                <div className="flex items-center space-x-2 text-slate-600 text-sm">
                  <span className="font-medium">{sourceFramework}</span>
                  <ArrowRight className="h-4 w-4" />
                  <span className="font-medium">{targetFramework}</span>
                </div>
              )}
            </div>
            <Button
              onClick={handleCrosswalkSearch}
              disabled={!sourceFramework || !targetFramework || loading}
              className="flex items-center space-x-2"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span>{loading ? "Searching..." : "Find Mappings"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searched && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Crosswalk Results</span>
              <Badge variant="outline">
                {crosswalkResults.length} mapping
                {crosswalkResults.length !== 1 ? "s" : ""} found
              </Badge>
            </CardTitle>
            <CardDescription>
              {sourceFramework && targetFramework && (
                <>
                  Control mappings between {sourceFramework} and {targetFramework}
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {crosswalkResults.length > 0 ? (
              <div className="space-y-4">
                {crosswalkResults.map((mapping) => (
                  <div
                    key={mapping.id}
                    className="rounded-lg border p-4 transition-colors hover:bg-slate-50"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="font-mono">
                              {mapping.source_control_id}
                            </Badge>
                            <span className="font-mono text-lg text-slate-400">
                              {getMappingTypeIcon(mapping.mapping_type)}
                            </span>
                            <Badge variant="outline" className="font-mono">
                              {mapping.target_control_id}
                            </Badge>
                          </div>
                          <Badge
                            className={`${getConfidenceColor(mapping.confidence_score)} border-0`}
                          >
                            {(mapping.confidence_score * 100).toFixed(0)}% confidence
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                          <div>
                            <p className="font-medium text-slate-700">{mapping.source_framework}</p>
                            <p className="text-slate-600">Control: {mapping.source_control_id}</p>
                          </div>
                          <div>
                            <p className="font-medium text-slate-700">{mapping.target_framework}</p>
                            <p className="text-slate-600">Control: {mapping.target_control_id}</p>
                          </div>
                        </div>
                      </div>

                      <div className="ml-4 flex items-center space-x-2">
                        <Badge
                          variant={mapping.mapping_type === "equivalent" ? "default" : "secondary"}
                        >
                          {mapping.mapping_type}
                        </Badge>
                        {mapping.verified_by && (
                          <Badge variant="outline" className="border-green-300 text-green-700">
                            Verified
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-slate-500 text-xs">
                      <span>Created: {new Date(mapping.created_at).toLocaleDateString()}</span>
                      {mapping.verified_at && (
                        <span>Verified: {new Date(mapping.verified_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                <h3 className="mb-2 font-medium text-lg text-slate-900">No Mappings Found</h3>
                <p className="mb-4 text-slate-600">
                  No direct mappings were found between {sourceFramework} and {targetFramework}.
                </p>
                <div className="space-y-2 text-slate-500 text-sm">
                  <p>This could mean:</p>
                  <ul className="list-inside list-disc space-y-1">
                    <li>The frameworks don&apos;t have established mappings yet</li>
                    <li>The mapping data hasn&apos;t been imported</li>
                    <li>Try a more general search query</li>
                    <li>Consider using the Enhanced Control Mapping for AI-generated mappings</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Access */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Framework Combinations</CardTitle>
          <CardDescription>Quick access to commonly requested crosswalks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              ["ISO 27001", "NIST 800-53"],
              ["SOC 2", "ISO 27001"],
              ["NIST 800-53", "NIST Cybersecurity Framework"],
              ["PCI DSS", "ISO 27001"],
              ["HIPAA", "NIST 800-53"],
              ["GDPR", "ISO 27001"],
            ].map(([source, target]) => (
              <Button
                key={`${source}-${target}`}
                variant="outline"
                size="sm"
                onClick={() => {
                  setSourceFramework(source);
                  setTargetFramework(target);
                }}
                className="h-auto justify-start p-3 text-left"
              >
                <div className="flex items-center space-x-2 text-xs">
                  <span className="font-medium">{source}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium">{target}</span>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
