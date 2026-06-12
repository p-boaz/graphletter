import { randomUUID } from "crypto";
import { appendFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib/ai/assessment-logging");

export type AIAssessmentLogScope = "ai_call" | "control_assessment" | "retry" | "timeout";
export type AIAssessmentLogStatus = "success" | "error" | "warning";

export interface AIAssessmentLogEntry {
  id: string;
  timestamp: string;
  requestId?: string;
  sessionId?: string | null;
  scope: AIAssessmentLogScope;
  status: AIAssessmentLogStatus;
  evidenceId?: string;
  evidenceContentHash?: string;
  scfControlId?: string;
  objectiveIds?: string[];
  modelProvider?: string;
  modelName?: string;
  latencyMs?: number;
  prompt?: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ReadAIAssessmentLogsOptions {
  limit?: number;
  requestId?: string;
  scfControlId?: string;
  evidenceContentHash?: string;
  scope?: AIAssessmentLogScope;
}

const LOG_DIR = join(process.cwd(), ".logs", "ai-assessment");
const LOG_FILE = join(LOG_DIR, "assessment-logs.jsonl");

export async function appendAIAssessmentLog(
  entry: Omit<AIAssessmentLogEntry, "id" | "timestamp">
): Promise<AIAssessmentLogEntry> {
  const fullEntry: AIAssessmentLogEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };

  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, `${JSON.stringify(fullEntry)}\n`, "utf8");
  } catch (error) {
    log.error("assessment_logging.append_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  return fullEntry;
}

export async function readAIAssessmentLogs(
  options: ReadAIAssessmentLogsOptions = {}
): Promise<AIAssessmentLogEntry[]> {
  const { limit = 100, requestId, scfControlId, evidenceContentHash, scope } = options;

  try {
    const raw = await readFile(LOG_FILE, "utf8");
    const parsed = raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as AIAssessmentLogEntry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is AIAssessmentLogEntry => entry !== null);

    const filtered = parsed.filter((entry) => {
      if (requestId && entry.requestId !== requestId) return false;
      if (scfControlId && entry.scfControlId !== scfControlId) return false;
      if (evidenceContentHash && entry.evidenceContentHash !== evidenceContentHash) return false;
      if (scope && entry.scope !== scope) return false;
      return true;
    });

    return filtered.reverse().slice(0, Math.max(1, Math.min(limit, 1000)));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return [];
    }
    log.error("assessment_logging.read_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
