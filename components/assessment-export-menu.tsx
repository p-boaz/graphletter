"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ExportFormat = "csv" | "json";

/**
 * Download menu for assessment results. Fetches the export route so failures
 * surface as a toast instead of navigating to a JSON error page; the blob +
 * anchor dance preserves the server's dated filename.
 */
export function AssessmentExportMenu() {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    try {
      const response = await fetch(`/api/assessments/export?format=${format}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Export failed");
      }

      const disposition = response.headers.get("Content-Disposition") || "";
      const filename =
        /filename="([^"]+)"/.exec(disposition)?.[1] || `graphletter-assessments.${format}`;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={exporting}
          data-testid="assessments-export-button"
        >
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Exporting…" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem data-testid="assessments-export-csv" onClick={() => handleExport("csv")}>
          CSV (summary per control)
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="assessments-export-json"
          onClick={() => handleExport("json")}
        >
          JSON (full detail)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
