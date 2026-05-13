import { Database, FileText } from "lucide-react";
import { Card } from "./ui/card";

interface EvidenceSummaryCardProps {
  totalEvidenceFiles: number;
  totalEvidenceRecords: number;
  percentage?: number; // e.g., percent of evidence uploaded or similar
  description?: string;
  title: string; // Top-left small label
  label: string; // Main heading
}

export function EvidenceSummaryCard({
  totalEvidenceFiles,
  totalEvidenceRecords,
  percentage = 100,
  description = "Total unique evidence files and records uploaded.",
  title,
  label,
}: EvidenceSummaryCardProps) {
  return (
    <Card className="min-w-0 flex-1 min-h-[220px] rounded-2xl shadow-lg border border-gray-100 bg-gradient-to-br from-white via-gray-50 to-orange-50 p-6 flex flex-col justify-between transition-transform hover:scale-[1.02]">
      {/* Title and Percentage */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-lg text-gray-900">{title}</span>
      </div>
      {/* Animated Progress Bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {/* Main Metrics */}
      <div className="flex flex-row items-end justify-start gap-8 mt-2 mb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-8 w-8 text-orange-500" />
          <div>
            <div className="text-4xl font-extrabold text-gray-900">{totalEvidenceFiles}</div>
            <div className="text-xs text-gray-500">Files</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Database className="h-8 w-8 text-orange-400" />
          <div>
            <div className="text-4xl font-extrabold text-gray-900">{totalEvidenceRecords}</div>
            <div className="text-xs text-gray-500">Records</div>
          </div>
        </div>
      </div>
      {/* Label and Description */}
      <div className="mt-4">
        <div className="text-base font-medium text-gray-800">{label}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
    </Card>
  );
}
