import { createLogger } from "@/lib/logger";
import {
  CATALOG_FRAMEWORK_COLUMNS,
  SUPPORTED_FRAMEWORK_COUNT,
  type CatalogFrameworkColumn,
} from "@/lib/scf/__generated__/framework-columns";
import type {
  SCFAuthoritativeSource,
  SCFControl,
  SCFDomain,
  SCFFrameworkMapping,
  SCFGeography,
  SCFImportResult,
  SCFPrinciple,
} from "@/lib/scf-types";

const log = createLogger("scf-parser");

export interface ControlMapping {
  controlId: string;
  frameworkName: string;
  frameworkVersion?: string;
  frameworkControlId: string;
  mappingType: "direct" | "partial" | "derived";
}

export interface FrameworkColumnConfig {
  columnIndex: number;
  frameworkName: string;
  frameworkVersion?: string;
  /**
   * Exact header cell expected at columnIndex in controls.csv. Validated at
   * parse time — column positions shift between SCF releases, and a silent
   * shift mislabels every mapping (this happened in the 2026.1.1 pivot).
   */
  expectedHeader: string;
  mappingType: "direct" | "partial" | "derived";
}

// Framework column config is derived from the generated catalog projection of
// data/framework-manifest.json (see scripts/generate-framework-manifest.ts).
// The manifest is the sole import contract: on every SCF version bump, run
// `pnpm manifest:generate` and review the diff — indices shift when upstream
// inserts columns, and expectedHeader makes a stale map a hard failure
// instead of silently mislabeled mappings (this happened in the 2026.1.1
// pivot). Excluded frameworks are already dropped at generation time.
export interface CatalogFrameworkColumnConfig extends FrameworkColumnConfig {
  catalogKey: string;
  kind: CatalogFrameworkColumn["kind"];
  family: string;
  geography: string;
  visibility: CatalogFrameworkColumn["visibility"];
  exposureStatus: CatalogFrameworkColumn["exposureStatus"];
  sourceUrl?: string;
}

export const FRAMEWORK_COLUMNS: CatalogFrameworkColumnConfig[] = CATALOG_FRAMEWORK_COLUMNS.map(
  (column) => ({
    columnIndex: column.columnIndex,
    frameworkName: column.frameworkName,
    ...(column.frameworkVersion ? { frameworkVersion: column.frameworkVersion } : {}),
    expectedHeader: column.expectedHeader,
    mappingType: "direct" as const,
    catalogKey: column.catalogKey,
    kind: column.kind,
    family: column.family,
    geography: column.geography,
    visibility: column.visibility,
    exposureStatus: column.exposureStatus,
    ...(column.sourceUrl ? { sourceUrl: column.sourceUrl } : {}),
  })
);

// Single source of truth for "how many frameworks does Graphletter map".
// Public copy must stay consistent with this — surfaces that can't import it
// (client bundles, markdown) hardcode the number with a comment pointing here.
// See plans/task-2026-07-11-framework-count-truth-line.md.
export const MAPPED_FRAMEWORK_COUNT = SUPPORTED_FRAMEWORK_COUNT;

export class SCFParser {
  static parseCSVData(csvData: string): SCFImportResult {
    log.info("Starting CSV parsing");

    try {
      // Parse the entire CSV properly, handling multi-line quoted fields
      const { headers, rows } = SCFParser.parseCSVContent(csvData);

      log.info("Headers parsed", { count: headers.length });
      log.debug("First 10 headers", { headers: headers.slice(0, 10) });
      log.debug("Last 10 headers", { headers: headers.slice(-10) });
      log.info("Data rows", { count: rows.length });

      if (headers.length < 10) {
        throw new Error(
          `Too few columns found (${headers.length}). Expected 200+ columns for SCF data.`
        );
      }

      // Find key column indices with detailed logging
      const columnIndices = SCFParser.findKeyColumns(headers);
      log.debug("Key column indices", { columnIndices });

      // Debug the description column specifically
      log.debug("Looking for description column");
      headers.forEach((header, index) => {
        const lowerHeader = header.toLowerCase().replace(/\s+/g, " ").trim();
        if (lowerHeader.includes("description") || lowerHeader.includes("framework")) {
          log.debug("Potential description column found", {
            index,
            header,
            normalized: lowerHeader,
          });
        }
      });

      // More flexible validation - only require the first 4 basic columns
      const requiredColumns = {
        domain: columnIndices.domain,
        control: columnIndices.control,
        id: columnIndices.id,
        description: columnIndices.description,
      };

      log.debug("Required columns check", { requiredColumns });

      const missingColumns = Object.entries(requiredColumns)
        .filter(([, index]) => index === undefined)
        .map(([name]) => name);

      if (missingColumns.length > 0) {
        log.warn("Missing columns", {
          missingColumns,
          firstHeaders: headers.slice(0, 20),
        });

        // Try to find description column manually
        const descriptionIndex = headers.findIndex(
          (h) =>
            h.toLowerCase().includes("control description") ||
            h.toLowerCase().includes("framework (scf)") ||
            h.toLowerCase().includes("secure controls framework")
        );

        if (descriptionIndex >= 0) {
          log.debug("Found description column manually", {
            index: descriptionIndex,
            header: headers[descriptionIndex],
          });
          columnIndices.description = descriptionIndex;
        }

        // Re-check after manual fix
        if (
          !columnIndices.domain ||
          !columnIndices.control ||
          !columnIndices.id ||
          !columnIndices.description
        ) {
          throw new Error(
            `Required columns not found in CSV. Missing: ${missingColumns.join(
              ", "
            )}. Expected: SCF Domain, SCF Control, SCF #, Control Description`
          );
        }
      }

      const controls: SCFControl[] = [];
      const domainMap = new Map<string, SCFDomain>();
      const frameworkMap = new Map<string, SCFFrameworkMapping>();
      const errors: string[] = [];
      const warnings: string[] = [];

      // Parse all data rows
      const maxRows = rows.length; // Process all rows
      let successfulRows = 0;

      log.info("Processing rows", { count: maxRows });

      for (let i = 0; i < maxRows; i++) {
        const row = rows[i];

        try {
          if (row.length < headers.length * 0.3) {
            // At least 30% of expected columns
            warnings.push(`Row ${i + 1}: Too few columns (${row.length}/${headers.length})`);
            continue;
          }

          // Create row object
          const rowData: { [key: string]: string } = {};
          headers.forEach((header, index) => {
            rowData[header] = row[index] || "";
          });

          const control = SCFParser.parseControlFromRow(rowData, columnIndices, headers);
          if (control) {
            controls.push(control);
            successfulRows++;

            // Log first few successful controls
            if (successfulRows <= 3) {
              log.debug("Parsed control", {
                successfulRows,
                id: control.id,
                title: control.title,
                domain: control.domain,
                descriptionLength: control.description.length,
              });
            }

            // Extract domain info
            if (!domainMap.has(control.domain)) {
              const domainId = SCFParser.extractDomainId(control.id);
              domainMap.set(control.domain, {
                id: domainId,
                name: control.domain,
                description: `Controls related to ${control.domain.toLowerCase()}`,
                principles: [],
                controlCount: 0,
              });
            }

            // Extract framework mappings
            SCFParser.extractFrameworkMappings(rowData, headers, frameworkMap);
          } else {
            warnings.push(`Row ${i + 1}: Could not parse control data`);
          }
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : "Parse error"}`);
        }
      }

      log.info("Parsed controls", {
        successful: successfulRows,
        total: maxRows,
      });

      // Update domain control counts
      domainMap.forEach((domain) => {
        domain.controlCount = controls.filter((c) => c.domain === domain.name).length;
      });

      const domains = Array.from(domainMap.values());
      const frameworks = Array.from(frameworkMap.values());
      const totalMappings = frameworks.reduce((sum, fw) => sum + fw.totalMappings, 0);

      log.info("Final results", {
        controls: controls.length,
        domains: domains.length,
        frameworks: frameworks.length,
        totalMappings,
      });

      return {
        success: true,
        summary: {
          totalControls: controls.length,
          totalDomains: domains.length,
          totalFrameworks: frameworks.length,
          totalMappings,
          version: "2026.2",
        },
        controls,
        domains,
        frameworks,
        risks: [],
        threats: [],
        errors,
        warnings: warnings.slice(0, 50), // Limit warnings
      };
    } catch (error) {
      log.error("CSV parsing failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        summary: {
          totalControls: 0,
          totalDomains: 0,
          totalFrameworks: 0,
          totalMappings: 0,
          version: "2026.2",
        },
        controls: [],
        domains: [],
        frameworks: [],
        risks: [],
        threats: [],
        errors: [error instanceof Error ? error.message : "Unknown parsing error"],
        warnings: [],
      };
    }
  }

  private static parseCSVContent(csvData: string): {
    headers: string[];
    rows: string[][];
  } {
    const result: string[][] = [];
    let current: string[] = [];
    let currentField = "";
    let inQuotes = false;
    let i = 0;

    while (i < csvData.length) {
      const char = csvData[i];

      if (char === '"') {
        if (inQuotes && csvData[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === "," && !inQuotes) {
        // End of field
        current.push(currentField.trim());
        currentField = "";
        i++;
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        // End of row (only if not in quotes)
        current.push(currentField.trim());
        if (current.length > 0 && current.some((field) => field.length > 0)) {
          result.push(current);
        }
        current = [];
        currentField = "";

        // Skip \r\n combinations
        if (char === "\r" && csvData[i + 1] === "\n") {
          i += 2;
        } else {
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    }

    // Add the last field and row
    if (currentField || current.length > 0) {
      current.push(currentField.trim());
      if (current.length > 0 && current.some((field) => field.length > 0)) {
        result.push(current);
      }
    }

    if (result.length === 0) {
      throw new Error("No data found in CSV");
    }

    const headers = result[0];
    const rows = result.slice(1);

    return { headers, rows };
  }

  private static findKeyColumns(headers: string[]): {
    domain?: number;
    control?: number;
    id?: number;
    description?: number;
    question?: number;
    evidence?: number;
    [key: string]: number | undefined;
  } {
    const indices: { [key: string]: number | undefined } = {};

    headers.forEach((header, index) => {
      const lowerHeader = header.toLowerCase().replace(/\s+/g, " ").replace(/\n/g, " ").trim();

      // Core columns with more flexible matching
      if (lowerHeader.includes("scf domain")) {
        indices.domain = index;
      } else if (lowerHeader.includes("scf control") && !lowerHeader.includes("question")) {
        indices.control = index;
      } else if (lowerHeader.includes("scf #")) {
        indices.id = index;
      } else if (
        lowerHeader.includes("control description") ||
        lowerHeader.includes("framework (scf)") ||
        lowerHeader.includes("secure controls framework") ||
        (lowerHeader.includes("description") && lowerHeader.includes("scf"))
      ) {
        indices.description = index;
      } else if (lowerHeader.includes("control question")) {
        indices.question = index;
      } else if (lowerHeader.includes("evidence request")) {
        indices.evidence = index;
      }

      // Organization size columns
      if (
        lowerHeader.includes("micro-small business") ||
        (lowerHeader.includes("micro") && lowerHeader.includes("10"))
      ) {
        indices.guidanceMicro = index;
      } else if (lowerHeader.includes("small business") && lowerHeader.includes("10-49")) {
        indices.guidanceSmall = index;
      } else if (lowerHeader.includes("medium business") && lowerHeader.includes("50-249")) {
        indices.guidanceMedium = index;
      } else if (lowerHeader.includes("large business") && lowerHeader.includes("250-999")) {
        indices.guidanceLarge = index;
      } else if (lowerHeader.includes("enterprise") && lowerHeader.includes("1,000")) {
        indices.guidanceEnterprise = index;
      }

      // Applicability columns
      if (lowerHeader.includes("pptdf") && lowerHeader.includes("people")) {
        indices.applicabilityPeople = index;
      } else if (lowerHeader.includes("pptdf") && lowerHeader.includes("process")) {
        indices.applicabilityProcess = index;
      } else if (lowerHeader.includes("pptdf") && lowerHeader.includes("technology")) {
        indices.applicabilityTechnology = index;
      } else if (lowerHeader.includes("pptdf") && lowerHeader.includes("data")) {
        indices.applicabilityData = index;
      }
    });

    return indices;
  }

  private static parseControlFromRow(
    row: { [key: string]: string },
    columnIndices: ReturnType<typeof SCFParser.findKeyColumns>,
    headers: string[]
  ): SCFControl | null {
    const controlId = row[headers[columnIndices.id!]]?.trim();
    const controlTitle = row[headers[columnIndices.control!]]?.trim();
    const controlDescription = row[headers[columnIndices.description!]]?.trim();
    const domain = row[headers[columnIndices.domain!]]?.trim();

    if (!controlId || !controlTitle || !controlDescription || !domain) {
      return null;
    }

    // Parse organization guidance
    const organizationGuidance = {
      micro: columnIndices.guidanceMicro
        ? row[headers[columnIndices.guidanceMicro]]?.trim() || ""
        : "",
      small: columnIndices.guidanceSmall
        ? row[headers[columnIndices.guidanceSmall]]?.trim() || ""
        : "",
      medium: columnIndices.guidanceMedium
        ? row[headers[columnIndices.guidanceMedium]]?.trim() || ""
        : "",
      large: columnIndices.guidanceLarge
        ? row[headers[columnIndices.guidanceLarge]]?.trim() || ""
        : "",
      enterprise: columnIndices.guidanceEnterprise
        ? row[headers[columnIndices.guidanceEnterprise]]?.trim() || ""
        : "",
    };

    // Parse applicability
    const applicability = {
      people: columnIndices.applicabilityPeople
        ? !!row[headers[columnIndices.applicabilityPeople]]?.trim()
        : false,
      process: columnIndices.applicabilityProcess
        ? !!row[headers[columnIndices.applicabilityProcess]]?.trim()
        : false,
      technology: columnIndices.applicabilityTechnology
        ? !!row[headers[columnIndices.applicabilityTechnology]]?.trim()
        : false,
      governance: columnIndices.applicabilityData
        ? !!row[headers[columnIndices.applicabilityData]]?.trim()
        : false,
    };

    // Parse control questions
    const controlQuestions =
      columnIndices.question && row[headers[columnIndices.question]]?.trim()
        ? [row[headers[columnIndices.question]].trim()]
        : [];

    // Parse evidence requests
    const evidenceRequests =
      columnIndices.evidence && row[headers[columnIndices.evidence]]?.trim()
        ? [row[headers[columnIndices.evidence]].trim()]
        : [];

    // Parse framework mappings
    const mappings: { [framework: string]: string[] } = {};
    SCFParser.extractControlMappings(row, headers, mappings);

    return {
      id: controlId,
      title: controlTitle,
      description: controlDescription,
      domain,
      principle: "",
      controlQuestions,
      organizationGuidance,
      applicability,
      riskIds: [],
      threatIds: [],
      assessmentObjectives: [],
      evidenceRequests,
      mappings,
      version: "2026.2",
      lastUpdated: new Date(),
    };
  }

  private static extractControlMappings(
    row: { [key: string]: string },
    headers: string[],
    mappings: { [framework: string]: string[] }
  ) {
    // Look for framework columns
    headers.forEach((header) => {
      const value = row[header]?.trim();
      if (!value) return;

      const lowerHeader = header.toLowerCase();

      // Map common frameworks
      if (
        lowerHeader.includes("nist") &&
        lowerHeader.includes("800-53") &&
        lowerHeader.includes("rev5")
      ) {
        mappings["NIST 800-53 rev5"] = value.split(/[\n,]/).filter((v) => v.trim());
      } else if (
        lowerHeader.includes("iso") &&
        lowerHeader.includes("27001") &&
        lowerHeader.includes("2022")
      ) {
        mappings["ISO 27001:2022"] = value.split(/[\n,]/).filter((v) => v.trim());
      } else if (
        lowerHeader.includes("pci") &&
        lowerHeader.includes("dss") &&
        lowerHeader.includes("4.0")
      ) {
        mappings["PCI DSS 4.0"] = value.split(/[\n,]/).filter((v) => v.trim());
      } else if (lowerHeader.includes("gdpr") && lowerHeader.includes("eu")) {
        mappings.GDPR = value.split(/[\n,]/).filter((v) => v.trim());
      } else if (lowerHeader.includes("hipaa")) {
        mappings.HIPAA = value.split(/[\n,]/).filter((v) => v.trim());
      }
    });
  }

  // Public: the writer derives per-domain control counts with the same
  // id→domain rule the parser uses, so the two can never disagree.
  static extractDomainId(controlId: string): string {
    const match = controlId.match(/^([A-Z]+)-/);
    return match ? match[1] : controlId.substring(0, 3).toUpperCase();
  }

  private static extractFrameworkMappings(
    _row: { [key: string]: string },
    _headers: string[],
    frameworkMap: Map<string, SCFFrameworkMapping>
  ) {
    const frameworks = ["NIST 800-53 rev5", "ISO 27001:2022", "PCI DSS 4.0", "GDPR", "HIPAA"];

    frameworks.forEach((framework) => {
      if (!frameworkMap.has(framework)) {
        frameworkMap.set(framework, {
          frameworkName: framework,
          frameworkVersion: SCFParser.extractFrameworkVersion(framework),
          sourceUrl: SCFParser.getFrameworkUrl(framework),
          mappingType: "direct",
          totalMappings: 1,
        });
      }
    });
  }

  private static extractFrameworkVersion(frameworkName: string): string | undefined {
    const versionMatch = frameworkName.match(/v?(\d+\.\d+(?:\.\d+)?)/);
    return versionMatch ? versionMatch[1] : undefined;
  }

  private static getFrameworkUrl(frameworkName: string): string | undefined {
    const urls: { [key: string]: string } = {
      "NIST 800-53 rev5": "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final",
      "ISO 27001:2022": "https://www.iso.org/standard/27001",
      "PCI DSS 4.0": "https://www.pcisecuritystandards.org/",
      GDPR: "https://gdpr.eu/",
      HIPAA: "https://www.hhs.gov/hipaa/",
    };
    return urls[frameworkName];
  }

  // New method to parse Domains and Principles.csv
  static parsePrinciplesCSV(csvData: string): {
    principles: SCFPrinciple[];
    domains: SCFDomain[];
  } {
    log.info("Starting Principles CSV parsing");

    try {
      const { headers, rows } = SCFParser.parseCSVContent(csvData);

      const principles: SCFPrinciple[] = [];
      const domains: SCFDomain[] = [];

      log.info("Processing principle rows", { count: rows.length });
      log.debug("Headers", { headers });

      rows.forEach((row, index) => {
        if (row.length < 5) {
          log.warn("Row insufficient columns", {
            row: index + 1,
            columns: row.length,
            expected: 5,
          });
          return;
        }

        // The CSV structure is: #, SCF Domain, SCF Identifier, Principle, Principle Intent, [empty]
        const [numberStr, domainName, domainCode, principleName, principleIntent] = row;

        if (!domainCode || !domainName || !principleName || !principleIntent) {
          log.warn("Row missing required data", { row: index + 1 });
          return;
        }

        // Clean up the number (remove any leading # or spaces)
        const cleanNumber = numberStr.replace(/^#?\s*/, "").trim();

        const principle: SCFPrinciple = {
          id: `${domainCode}-PRINCIPLE`,
          number: parseInt(cleanNumber) || index + 1,
          domainCode: domainCode.trim(),
          domainName: domainName.trim(),
          principleName: principleName.trim(),
          principleIntent: principleIntent.trim(),
          version: "2026.2",
        };

        principles.push(principle);

        // Create domain if not exists
        if (!domains.find((d) => d.id === domainCode.trim())) {
          domains.push({
            id: domainCode.trim(),
            name: domainName.trim(),
            description: principleIntent.trim(),
            principles: [principleName.trim()],
            principleIntent: principleIntent.trim(),
            controlCount: 0,
          });
        }
      });

      log.info("Parsed principles", {
        principles: principles.length,
        domains: domains.length,
      });
      return { principles, domains };
    } catch (error) {
      log.error("Principles CSV parsing failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { principles: [], domains: [] };
    }
  }

  // New method to parse Authoritative Sources.csv
  static parseAuthoritativeSourcesCSV(csvData: string): SCFAuthoritativeSource[] {
    log.info("Starting Authoritative Sources CSV parsing");

    try {
      const { rows } = SCFParser.parseCSVContent(csvData);

      const sources: SCFAuthoritativeSource[] = [];

      log.info("Processing authoritative source rows", { count: rows.length });

      // Upstream column order ("Focal Documents" sheet, SCF 2026.2 — the FDT
      // short-name column was removed upstream in 2026.2):
      //  0: Geography                   ("General" for globally applicable)
      //  1: SCF Column Header           → mappingColumnHeader
      //  2: Focal Document Identifier   → id slug (canonical upstream key)
      //  3: Source                      → sourceOrganization
      //  4: Focal Document Name         → authoritativeSource
      //  5: Focal Document Source URL   → sourceUrl
      //  6: Set Theory Relationship Map → strmUrl
      rows.forEach((row, index) => {
        if (row.length < 7) {
          log.warn("Row insufficient columns", {
            row: index + 1,
            columns: row.length,
            expected: 7,
          });
          return;
        }

        const [geography, mappingColumnHeader, fdi, sourceOrg, fdn, sourceUrl, strmUrl] = row;

        if (!geography || !mappingColumnHeader || !fdn) {
          log.warn("Row missing required data", { row: index + 1 });
          return;
        }

        // Upstream uses these as status markers, not geographies — skip quietly.
        if (geography === "Deleted" || geography === "Not Complete") {
          return;
        }

        const validGeographies = ["General", "US", "EMEA", "APAC", "Americas"];
        if (!validGeographies.includes(geography)) {
          log.warn("Row invalid geography", { row: index + 1, geography });
          return;
        }

        const source: SCFAuthoritativeSource = {
          id: (fdi || `${geography}-${mappingColumnHeader}`)
            .replace(/\s+/g, "-")
            .replace(/[^a-zA-Z0-9-]/g, ""),
          geography: geography as SCFGeography,
          mappingColumnHeader,
          sourceOrganization: sourceOrg || "Unknown",
          authoritativeSource: fdn,
          strmUrl: strmUrl || undefined,
          sourceUrl: sourceUrl || undefined,
          version: "2026.2",
        };

        sources.push(source);
      });

      log.info("Parsed authoritative sources", { count: sources.length });
      return sources;
    } catch (error) {
      log.error("Authoritative Sources CSV parsing failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // Enhanced method to parse all SCF data types
  static parseAllSCFData(
    principlesCSV?: string,
    authSourcesCSV?: string,
    controlsCSV?: string
  ): SCFImportResult {
    log.info("Starting comprehensive SCF data parsing");

    let principles: SCFPrinciple[] = [];
    let domains: SCFDomain[] = [];
    let authoritativeSources: SCFAuthoritativeSource[] = [];
    let controlResult: SCFImportResult = {
      success: true,
      summary: {
        totalControls: 0,
        totalDomains: 0,
        totalFrameworks: 0,
        totalMappings: 0,
        totalPrinciples: 0,
        totalAuthoritativeSources: 0,
        version: "2026.2",
      },
      controls: [],
      domains: [],
      frameworks: [],
      risks: [],
      threats: [],
      errors: [],
      warnings: [],
    };

    const errors: string[] = [];
    const warnings: string[] = [];

    // Parse principles if provided
    if (principlesCSV) {
      try {
        const principleResult = SCFParser.parsePrinciplesCSV(principlesCSV);
        principles = principleResult.principles;
        domains = principleResult.domains;
      } catch (error) {
        errors.push(
          `Principles parsing error: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    // Parse authoritative sources if provided
    if (authSourcesCSV) {
      try {
        authoritativeSources = SCFParser.parseAuthoritativeSourcesCSV(authSourcesCSV);
      } catch (error) {
        errors.push(
          `Authoritative sources parsing error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    // Parse controls if provided (using existing logic)
    if (controlsCSV) {
      try {
        controlResult = SCFParser.parseCSVData(controlsCSV);
        errors.push(...controlResult.errors);
        warnings.push(...controlResult.warnings);
      } catch (error) {
        errors.push(
          `Controls parsing error: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    return {
      success: errors.length === 0,
      summary: {
        totalControls: controlResult.controls.length,
        totalDomains: domains.length || controlResult.domains.length,
        totalFrameworks: authoritativeSources.length + controlResult.frameworks.length,
        totalMappings: controlResult.summary.totalMappings,
        totalPrinciples: principles.length,
        totalAuthoritativeSources: authoritativeSources.length,
        version: "2026.2",
      },
      controls: controlResult.controls,
      domains: domains.length > 0 ? domains : controlResult.domains,
      frameworks: controlResult.frameworks,
      principles,
      authoritativeSources,
      risks: controlResult.risks,
      threats: controlResult.threats,
      errors: [...new Set(errors)], // Remove duplicates
      warnings: [...new Set(warnings)], // Remove duplicates
    };
  }

  // New method to parse control mappings from controls.csv
  /**
   * Verify every FRAMEWORK_COLUMNS entry still points at the header it was
   * derived from. Whitespace is normalized on both sides; any mismatch is a
   * hard error — mapping from a shifted column silently corrupts every
   * framework label downstream.
   */
  private static assertFrameworkColumnAlignment(headers: string[]): void {
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    const misaligned = FRAMEWORK_COLUMNS.filter(
      (config) => normalize(headers[config.columnIndex] ?? "") !== normalize(config.expectedHeader)
    );
    if (misaligned.length > 0) {
      const detail = misaligned
        .map(
          (c) =>
            `${c.frameworkName} @ column ${c.columnIndex}: expected "${normalize(c.expectedHeader)}", found "${normalize(headers[c.columnIndex] ?? "(missing)")}"`
        )
        .join("; ");
      throw new Error(
        `FRAMEWORK_COLUMNS is misaligned with the controls CSV header (${misaligned.length} column(s)). ` +
          `The SCF workbook layout changed — regenerate FRAMEWORK_COLUMNS. ${detail}`
      );
    }
  }

  static parseControlMappings(csvData: string): ControlMapping[] {
    log.info("Starting Control Mappings parsing");

    // Deliberately outside the try below: a misaligned column map must abort
    // the import loudly, never degrade to an empty mapping set.
    const parsed = SCFParser.parseCSVContent(csvData);
    SCFParser.assertFrameworkColumnAlignment(parsed.headers);

    try {
      const { rows } = parsed;
      const mappings: ControlMapping[] = [];
      const seenMappings = new Set<string>();

      log.info("Processing control rows for mappings", { count: rows.length });

      rows.forEach((row, rowIndex) => {
        if (row.length < 10) {
          log.warn("Row insufficient columns for mappings", {
            row: rowIndex + 1,
          });
          return;
        }

        const controlId = row[2]?.trim(); // SCF # column
        if (!controlId) {
          log.warn("Row missing control ID", { row: rowIndex + 1 });
          return;
        }

        // Process each framework column
        FRAMEWORK_COLUMNS.forEach((frameworkConfig) => {
          const mappingValue = row[frameworkConfig.columnIndex]?.trim();

          if (!mappingValue) {
            return; // Skip empty mappings
          }

          // Split on newlines and process each control ID
          const frameworkControlIds = mappingValue
            .split("\n")
            .map((id) => id.trim())
            .filter((id) => id.length > 0);

          frameworkControlIds.forEach((frameworkControlId) => {
            // Set-based dedupe — the linear scan this replaced was O(n²) and
            // unusable at full-catalog scale (~70k mappings).
            const dedupeKey = `${controlId} ${frameworkConfig.catalogKey} ${frameworkControlId}`;
            if (!seenMappings.has(dedupeKey)) {
              seenMappings.add(dedupeKey);
              mappings.push({
                controlId,
                frameworkName: frameworkConfig.frameworkName,
                frameworkVersion: frameworkConfig.frameworkVersion,
                frameworkControlId,
                mappingType: frameworkConfig.mappingType,
              });
            }
          });
        });
      });

      log.info("Parsed control mappings", { count: mappings.length });
      return mappings;
    } catch (error) {
      log.error("Control mappings parsing failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
