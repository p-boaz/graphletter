import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import { selectAllRows, chunkArray, IN_CHUNK_SIZE } from "@/lib/database/paged-select";
import { scanEvidenceFreshness } from "./freshness-engine";
import { resolveGapToErl } from "./gap-erl-resolver";
import { calculatePostureScore } from "./posture-scorer";

const log = createLogger("inbox-generator");

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes per Decision 9
const MAX_HIGH_LEVERAGE_ITEMS = 5;

export type InboxItemType =
  | "stale_evidence"
  | "expiring_evidence"
  | "missing_control"
  | "partial_control"
  | "high_leverage_upload";

export type InboxItemPriority = "critical" | "high" | "medium" | "low";

export interface InboxItem {
  id: string;
  type: InboxItemType;
  priority: InboxItemPriority;
  title: string;
  description: string;
  actionLabel: string;
  actionUrl: string;
  context?: {
    controlIds?: string[];
    frameworkId?: string;
    evidenceType?: string;
    documentationArtifact?: string;
  };
  metadata: Record<string, unknown>;
}

export interface InboxResult {
  items: InboxItem[];
  totalItems: number;
  generatedAt: string;
  cachedUntil: string;
  postureSummary?: {
    score: number;
    trend: "up" | "down" | "stable";
    lastChange: number;
  };
}

// In-memory cache (5min TTL per user)
const inboxCache = new Map<string, { result: InboxResult; expiresAt: number }>();

/**
 * Invalidate the inbox cache for a user (called after upload/assessment).
 */
export function invalidateInboxCache(userId: string): void {
  // Invalidate all keys for this user (there may be multiple framework variants)
  for (const key of inboxCache.keys()) {
    if (key.startsWith(userId)) {
      inboxCache.delete(key);
    }
  }
  log.debug("inbox_generator.cache_invalidated", { userId });
}

const PRIORITY_ORDER: Record<InboxItemPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function getLeverageScore(item: InboxItem): number {
  const explicit = item.metadata.leverageScore;
  if (typeof explicit === "number") return explicit;
  return item.context?.controlIds?.length || 1;
}

interface GapRow {
  scf_control_id: string;
  status: string;
  framework_id?: string | null;
}

interface ControlRow {
  id: string;
  title: string | null;
  domain_id: string;
}

/**
 * Generate the compliance inbox for a user.
 * Cached for 5min per Decision 9. Invalidated on upload/assessment completion.
 */
export async function generateInbox(
  supabase: SupabaseClient,
  userId: string,
  frameworkId?: string | null
): Promise<InboxResult> {
  const cacheKey = `${userId}::${frameworkId || "all"}`;
  const now = Date.now();

  // Check cache
  const cached = inboxCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    log.debug("inbox_generator.cache_hit", { userId, frameworkId });
    return cached.result;
  }

  const startMs = Date.now();

  // Fetch data in parallel: freshness scan, gap data, posture score
  const [freshness, gapResult, posture] = await Promise.all([
    scanEvidenceFreshness(supabase, userId, frameworkId).catch((err) => {
      log.warn("inbox_generator.freshness_error", {
        error: err instanceof Error ? err.message : "unknown",
      });
      return null;
    }),
    fetchGapData(supabase, userId, frameworkId),
    calculatePostureScore(supabase, userId, frameworkId).catch(() => null),
  ]);

  const items: InboxItem[] = [];

  // 1. Stale evidence items (critical priority)
  if (freshness) {
    for (const item of freshness.items) {
      if (item.status === "stale") {
        items.push({
          id: `stale-${item.evidenceId}`,
          type: "stale_evidence",
          priority: "critical",
          title: `Expired: ${item.fileName}`,
          description: `This ${item.evidenceType} evidence expired ${Math.abs(item.daysUntilExpiry)} days ago. Re-upload a current version to maintain compliance.`,
          actionLabel: "Re-upload",
          actionUrl: "/dashboard/evidence",
          context: {
            evidenceType: item.evidenceType,
          },
          metadata: {
            evidenceId: item.evidenceId,
            daysExpired: Math.abs(item.daysUntilExpiry),
          },
        });
      }
    }

    // 2. Expiring evidence items (high priority)
    for (const item of freshness.items) {
      if (item.status === "expiring") {
        items.push({
          id: `expiring-${item.evidenceId}`,
          type: "expiring_evidence",
          priority: "high",
          title: `Expiring in ${item.daysUntilExpiry}d: ${item.fileName}`,
          description: `This ${item.evidenceType} evidence expires in ${item.daysUntilExpiry} days. Refresh before it becomes stale.`,
          actionLabel: "Refresh",
          actionUrl: "/dashboard/evidence",
          context: {
            evidenceType: item.evidenceType,
          },
          metadata: {
            evidenceId: item.evidenceId,
            daysUntilExpiry: item.daysUntilExpiry,
          },
        });
      }
    }
  }

  // 3. Missing controls + high leverage uploads from gap data
  if (gapResult) {
    // Gap data can repeat a control (e.g. one row per mapped framework); item
    // ids are keyed by control id, so keep only the first occurrence of each.
    const seenControlIds = new Set<string>();
    const uniqueGaps = gapResult.gaps.filter((g) => {
      if (seenControlIds.has(g.scf_control_id)) return false;
      seenControlIds.add(g.scf_control_id);
      return true;
    });
    const missingControls = uniqueGaps.filter((g) => g.status === "missing");
    const partialControls = uniqueGaps.filter((g) => g.status === "partial");

    // Resolve top ERL artifacts for missing controls
    if (missingControls.length > 0) {
      try {
        const erlRemediations = await resolveGapToErl(
          supabase,
          missingControls.map((g) => ({
            scfControlId: g.scf_control_id,
            status: g.status as "missing" | "partial" | "conflicting",
          }))
        );

        // Top N as high-leverage upload items
        for (const erl of erlRemediations.slice(0, MAX_HIGH_LEVERAGE_ITEMS)) {
          const leverageScore = erl.controlsOverlap;
          items.push({
            id: `leverage-${erl.erlId}`,
            type: "high_leverage_upload",
            priority: leverageScore >= 2 ? "high" : "medium",
            title: `Upload: ${erl.artifact}`,
            description: `Covers ${erl.controlsOverlap} missing control${erl.controlsOverlap !== 1 ? "s" : ""}. ${erl.artifactDescription || erl.areaOfFocus}`,
            actionLabel: "Upload Evidence",
            actionUrl: "/dashboard",
            context: {
              controlIds: erl.controlsCovered,
              frameworkId: frameworkId || undefined,
              documentationArtifact: erl.artifact,
            },
            metadata: {
              erlId: erl.erlId,
              controlsOverlap: erl.controlsOverlap,
              leverageScore,
              priority: erl.priority,
            },
          });
        }
      } catch (erlErr) {
        log.warn("inbox_generator.erl_resolution_error", {
          error: erlErr instanceof Error ? erlErr.message : "unknown",
        });
      }
    }

    // Missing controls grouped by domain so the inbox stays action-oriented.
    const missingByDomain = new Map<string, GapRow[]>();
    for (const gap of missingControls) {
      const domainId = gapResult.controlDetails.get(gap.scf_control_id)?.domain_id || "Other";
      const group = missingByDomain.get(domainId) || [];
      group.push(gap);
      missingByDomain.set(domainId, group);
    }

    const groupedMissing = Array.from(missingByDomain.entries()).sort((a, b) => {
      const countDiff = b[1].length - a[1].length;
      if (countDiff !== 0) return countDiff;
      return a[0].localeCompare(b[0]);
    });

    for (const [domainId, gaps] of groupedMissing.slice(0, 10)) {
      const firstControl = gapResult.controlDetails.get(gaps[0].scf_control_id);
      const controlIds = gaps.map((gap) => gap.scf_control_id).sort();
      const title =
        gaps.length === 1
          ? `Missing: ${controlIds[0]}${firstControl?.title ? ` — ${firstControl.title}` : ""}`
          : `${domainId}: ${gaps.length} controls missing`;
      items.push({
        id: gaps.length === 1 ? `missing-${controlIds[0]}` : `missing-domain-${domainId}`,
        type: "missing_control",
        priority: "medium",
        title,
        description:
          gaps.length === 1
            ? `Upload evidence for ${controlIds[0]} to close this gap.`
            : `Start with the highest-coverage artifact for this domain, then review ${gaps.length} missing controls.`,
        actionLabel: "Upload Evidence",
        actionUrl: "/dashboard",
        context: {
          controlIds,
          frameworkId: frameworkId || undefined,
        },
        metadata: {
          controlId: gaps.length === 1 ? controlIds[0] : undefined,
          domainId,
          groupedCount: gaps.length,
          leverageScore: gaps.length,
        },
      });
    }

    // Partial controls (low priority)
    for (const gap of partialControls.slice(0, 5)) {
      const control = gapResult.controlDetails.get(gap.scf_control_id);
      items.push({
        id: `partial-${gap.scf_control_id}`,
        type: "partial_control",
        priority: "low",
        title: `Strengthen: ${gap.scf_control_id}${control?.title ? ` — ${control.title}` : ""}`,
        description: `Partial evidence exists but is insufficient. Upload stronger documentation.`,
        actionLabel: "Strengthen Evidence",
        actionUrl: "/dashboard",
        context: {
          controlIds: [gap.scf_control_id],
          frameworkId: frameworkId || undefined,
        },
        metadata: {
          controlId: gap.scf_control_id,
          domainId: control?.domain_id,
        },
      });
    }
  }

  // Sort by priority, then by type weight
  items.sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pDiff !== 0) return pDiff;
    const leverageDiff = getLeverageScore(b) - getLeverageScore(a);
    if (leverageDiff !== 0) return leverageDiff;
    return a.title.localeCompare(b.title);
  });

  // Build posture summary
  let postureSummary: InboxResult["postureSummary"];
  if (posture) {
    postureSummary = {
      score: posture.overallScore,
      trend: "stable",
      lastChange: 0,
    };
  }

  const generatedAt = new Date().toISOString();
  const cachedUntil = new Date(now + CACHE_TTL_MS).toISOString();

  const result: InboxResult = {
    items,
    totalItems: items.length,
    generatedAt,
    cachedUntil,
    postureSummary,
  };

  // Cache the result
  inboxCache.set(cacheKey, { result, expiresAt: now + CACHE_TTL_MS });

  const durationMs = Date.now() - startMs;
  log.info("inbox_generator.generated", {
    userId,
    frameworkId,
    totalItems: items.length,
    durationMs,
  });

  return result;
}

async function fetchGapData(
  supabase: SupabaseClient,
  userId: string,
  frameworkId?: string | null
): Promise<{
  gaps: GapRow[];
  controlDetails: Map<string, ControlRow>;
} | null> {
  let typedGaps: GapRow[];

  try {
    typedGaps = await selectAllRows<GapRow>(() => {
      let q = supabase
        .from("control_gap_analysis")
        .select("scf_control_id, status, framework_id")
        .eq("user_id", userId)
        .in("status", ["missing", "partial", "conflicting"])
        .order("scf_control_id");
      if (frameworkId) {
        q = q.eq("framework_id", frameworkId);
      }
      return q;
    });
  } catch (err) {
    log.warn("inbox_generator.gap_fetch_error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }

  if (!typedGaps.length) return null;

  const controlIds = [...new Set(typedGaps.map((g) => g.scf_control_id))];

  // Chunk controlIds to stay under PostgREST's .in() list limits and paginate
  // each chunk's results past the 1000-row cap.
  const controlDetails = new Map<string, ControlRow>();
  const chunks = chunkArray(controlIds, IN_CHUNK_SIZE);

  for (const chunk of chunks) {
    let chunkRows: ControlRow[];
    try {
      chunkRows = await selectAllRows<ControlRow>(() =>
        supabase.from("scf_controls").select("id, title, domain_id").in("id", chunk).order("id")
      );
    } catch (err) {
      log.warn("inbox_generator.control_fetch_error", {
        error: err instanceof Error ? err.message : "unknown",
      });
      return null;
    }
    for (const c of chunkRows) {
      controlDetails.set(c.id, c);
    }
  }

  return { gaps: typedGaps, controlDetails };
}
