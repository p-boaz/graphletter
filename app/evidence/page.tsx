"use client";

import { CheckCircle, Clock, Download, Eye, FileText, Filter, Search, X } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useState } from "react";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function EvidencePage() {
  interface EvidenceApiItem {
    id: string;
    file_name: string;
    evidence_type?: string | null;
    evidence_status?: string | null;
    scf_control?: {
      id?: string | null;
      title?: string | null;
    } | null;
    erl_global_id?: string | null;
    created_at: string;
    file_size?: number | null;
    file_type?: string | null;
    description?: string | null;
    search_highlight?: {
      snippet?: string | null;
      match_position?: number;
      has_match?: boolean;
    } | null;
  }

  interface EvidenceDisplayItem {
    id: string;
    title: string;
    type: string;
    status: string;
    framework: string;
    control: string;
    uploadedAt: string;
    fileSize: string;
    fileType: string;
    description: string;
    searchHighlight?: EvidenceApiItem["search_highlight"];
  }

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchType, setSearchType] = useState("all");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<EvidenceApiItem[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceDisplayItem[]>([]);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(true);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [downloadingEvidenceId, setDownloadingEvidenceId] = useState<string | null>(null);

  const mapEvidenceToDisplayItem = useCallback(
    (item: EvidenceApiItem): EvidenceDisplayItem => ({
      id: item.id,
      title: item.file_name,
      type: item.evidence_type ?? "unknown",
      status: item.evidence_status ?? "pending",
      framework: item.scf_control?.title ? "Mapped Control" : "Unmapped",
      control: item.scf_control?.id || item.erl_global_id || "N/A",
      uploadedAt: item.created_at,
      fileSize: `${Math.max(1, Math.round((item.file_size || 0) / 1024))} KB`,
      fileType: item.file_type?.split("/")[1]?.toUpperCase() || "FILE",
      description: item.description || "No description available",
    }),
    []
  );

  React.useEffect(() => {
    const fetchEvidence = async () => {
      setIsLoadingEvidence(true);
      setEvidenceError(null);

      try {
        const response = await fetch("/api/evidence?limit=200");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load evidence");
        }

        const evidenceData = Array.isArray(data.evidence)
          ? (data.evidence as EvidenceApiItem[])
          : [];
        setEvidenceItems(evidenceData.map(mapEvidenceToDisplayItem));
      } catch (error) {
        setEvidenceError(error instanceof Error ? error.message : "Failed to load evidence");
        setEvidenceItems([]);
      } finally {
        setIsLoadingEvidence(false);
      }
    };

    fetchEvidence();
  }, [mapEvidenceToDisplayItem]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "submitted":
        return "bg-yellow-100 text-yellow-800";
      case "pending":
      case "under_review":
        return "bg-red-100 text-red-800";
      case "rejected":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "policy":
        return "bg-blue-100 text-blue-800";
      case "procedure":
        return "bg-purple-100 text-purple-800";
      case "documentation":
        return "bg-gray-100 text-gray-800";
      case "assessment":
        return "bg-green-100 text-green-800";
      case "contract":
        return "bg-orange-100 text-orange-800";
      case "diagram":
        return "bg-pink-100 text-pink-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Enhanced search function that can search content via API
  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const searchParams = new URLSearchParams({
          q: query,
          type: searchType,
          ...(statusFilter !== "all" && { status: statusFilter }),
          ...(typeFilter !== "all" && { evidence_type: typeFilter }),
          include_content: "false",
          limit: "50",
        });

        const response = await fetch(`/api/evidence/search?${searchParams}`);
        const data = await response.json();

        if (data.success) {
          const results = Array.isArray(data.results) ? (data.results as EvidenceApiItem[]) : [];
          setSearchResults(results);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [searchType, statusFilter, typeFilter]
  );

  const handleEvidenceOpen = async (evidenceId: string, action: "view" | "download") => {
    setDownloadingEvidenceId(evidenceId);
    try {
      const response = await fetch(`/api/evidence/download?id=${evidenceId}&action=${action}`);
      const data = await response.json();

      if (!response.ok || !data.success || !data.downloadUrl) {
        throw new Error(data.error || `Failed to ${action} evidence`);
      }

      if (action === "download") {
        const link = document.createElement("a");
        link.href = data.downloadUrl;
        link.download = data.filename || "evidence-file";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setEvidenceError(error instanceof Error ? error.message : "Failed to open evidence");
    } finally {
      setDownloadingEvidenceId(null);
    }
  };

  // Debounce search to avoid too many API calls
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm) {
        performSearch(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, performSearch]);

  // Use search results when searching, otherwise use fetched evidence with client-side filters
  const filteredEvidence = searchTerm
    ? searchResults.map((item) => ({
        ...mapEvidenceToDisplayItem(item),
        framework: "Search Result",
        searchHighlight: item.search_highlight,
      }))
    : evidenceItems.filter((item) => {
        const matchesStatus = statusFilter === "all" || item.status === statusFilter;
        const matchesType = typeFilter === "all" || item.type === typeFilter;
        return matchesStatus && matchesType;
      });

  const stats = {
    total: evidenceItems.length,
    approved: evidenceItems.filter((e) => e.status === "approved").length,
    pending: evidenceItems.filter((e) => e.status === "pending" || e.status === "submitted").length,
    needsReview: evidenceItems.filter(
      (e) => e.status === "needs-review" || e.status === "under_review"
    ).length,
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-50 to-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-8">
            <h1 className="ft-serif font-bold text-4xl text-slate-900 lg:text-5xl">
              Evidence Management
            </h1>
            <p className="ft-sans text-slate-600 text-xl max-w-3xl mx-auto">
              Search uploaded evidence, verify control mappings, and open source files for review or
              export.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="py-12 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="ft-sans text-slate-600 text-sm">Total Evidence</p>
                    <p className="ft-serif font-bold text-2xl text-slate-900">{stats.total}</p>
                  </div>
                  <FileText className="h-8 w-8 text-slate-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="ft-sans text-slate-600 text-sm">Approved</p>
                    <p className="ft-serif font-bold text-2xl text-green-600">{stats.approved}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="ft-sans text-slate-600 text-sm">Pending Review</p>
                    <p className="ft-serif font-bold text-2xl text-yellow-600">{stats.pending}</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="ft-sans text-slate-600 text-sm">Needs Review</p>
                    <p className="ft-serif font-bold text-2xl text-red-600">{stats.needsReview}</p>
                  </div>
                  <X className="h-8 w-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Search and Filter */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={`Search evidence${searchType === "content" ? " content" : searchType === "metadata" ? " metadata" : ""}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-slate-300 border-t-slate-600 rounded-full"></div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger className="w-40">
                  <Search className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Search Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fields</SelectItem>
                  <SelectItem value="content">Content Only</SelectItem>
                  <SelectItem value="metadata">Metadata Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="procedure">Procedure</SelectItem>
                  <SelectItem value="documentation">Documentation</SelectItem>
                  <SelectItem value="assessment">Assessment</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="diagram">Diagram</SelectItem>
                </SelectContent>
              </Select>

              <Button asChild>
                <Link href="/dashboard/evidence">Upload Evidence</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Evidence List */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          {evidenceError && (
            <Card className="mb-6 border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-700 text-sm">{evidenceError}</p>
              </CardContent>
            </Card>
          )}

          {isLoadingEvidence && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <p className="text-slate-600 text-sm">Loading evidence...</p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {filteredEvidence.map((item) => (
              <Card key={item.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="ft-serif font-semibold text-lg">{item.title}</h3>
                            <Badge className={getTypeColor(item.type)} variant="secondary">
                              {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                            </Badge>
                          </div>
                          <p className="ft-sans text-slate-600 text-sm">{item.description}</p>
                        </div>
                        <Badge className={getStatusColor(item.status)} variant="secondary">
                          {item.status.charAt(0).toUpperCase() +
                            item.status.slice(1).replace("-", " ")}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-slate-700">Framework:</span>
                          <span className="ml-1 text-slate-600">{item.framework}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-700">Control:</span>
                          <span className="ml-1 text-slate-600">{item.control}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-700">File:</span>
                          <span className="ml-1 text-slate-600">
                            {item.fileType} • {item.fileSize}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-700">Uploaded:</span>
                          <span className="ml-1 text-slate-600">
                            {new Date(item.uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEvidenceOpen(item.id, "view")}
                          disabled={downloadingEvidenceId === item.id}
                        >
                          <Eye className="mr-2 h-3 w-3" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEvidenceOpen(item.id, "download")}
                          disabled={downloadingEvidenceId === item.id}
                        >
                          <Download className="mr-2 h-3 w-3" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredEvidence.length === 0 && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="ft-serif font-medium text-lg text-slate-900 mt-4">
                No evidence found
              </h3>
              <p className="ft-sans text-slate-600 mt-2">
                Try adjusting your search terms or upload new evidence.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/dashboard/evidence">Upload Evidence</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
