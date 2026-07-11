// SCF-specific data types and interfaces

export interface SCFControl {
  id: string; // e.g., "ACC-01"
  title: string;
  description: string;
  domain: string;
  principle: string;
  controlQuestions: string[];

  // Organization size guidance
  organizationGuidance: {
    micro?: string;
    small?: string;
    medium?: string;
    large?: string;
    enterprise?: string;
  };

  // Applicability flags
  applicability: {
    people: boolean;
    process: boolean;
    technology: boolean;
    governance: boolean;
  };

  // Risk and threat associations
  riskIds: string[];
  threatIds: string[];

  // Assessment information
  assessmentObjectives: string[];
  evidenceRequests: string[];

  // Framework mappings - this is the gold mine!
  mappings: {
    [framework: string]: string[]; // e.g., "NIST_800_53_rev5": ["AC-1", "AC-2"]
  };

  // Metadata
  version: string;
  lastUpdated: Date;
}

export interface SCFDomain {
  id: string;
  name: string;
  description: string;
  principles: string[];
  principleIntent?: string; // Added to support principle intent from CSV
  controlCount: number;
}

// New interface for principles from Domains and Principles.csv
export interface SCFPrinciple {
  id: string;
  number: number;
  domainCode: string;
  domainName: string;
  principleName: string;
  principleIntent: string;
  version: string;
}

// New interface for authoritative sources from Authoritative Sources.csv
export interface SCFAuthoritativeSource {
  id: string;
  geography: SCFGeography;
  mappingColumnHeader: string;
  sourceOrganization: string;
  authoritativeSource: string;
  strmUrl?: string; // Set Theory Relationship Mapping URL
  sourceUrl?: string;
  version: string;
}

export interface SCFFrameworkMapping {
  frameworkName: string;
  frameworkVersion?: string;
  sourceUrl?: string;
  mappingType: "direct" | "partial" | "related" | "informative";
  totalMappings: number;
}

export interface SCFRisk {
  id: string;
  title: string;
  description: string;
  category: string;
  likelihood: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  relatedControls: string[];
}

export interface SCFThreat {
  id: string;
  title: string;
  description: string;
  category: string;
  source: string;
  relatedControls: string[];
}

export interface SCFAssessmentObjective {
  controlId: string;
  objective: string;
  testProcedures: string[];
  expectedEvidence: string[];
}

export interface SCFImportResult {
  success: boolean;
  summary: {
    totalControls: number;
    totalDomains: number;
    totalFrameworks: number;
    totalMappings: number;
    totalPrinciples?: number; // Added for principles support
    totalAuthoritativeSources?: number; // Added for authoritative sources support
    totalControlMappings?: number; // Added for control mappings support
    version: string;
  };
  controls: SCFControl[];
  domains: SCFDomain[];
  frameworks: SCFFrameworkMapping[];
  principles?: SCFPrinciple[]; // Added for principles support
  authoritativeSources?: SCFAuthoritativeSource[]; // Added for authoritative sources support
  controlMappings?: ControlMapping[]; // Added for control mappings support
  risks: SCFRisk[];
  threats: SCFThreat[];
  errors: string[];
  warnings: string[];
}

export interface ControlMapping {
  controlId: string;
  frameworkName: string;
  frameworkVersion?: string;
  frameworkControlId: string;
  mappingType: "direct" | "partial" | "derived";
}

// Organization size types for guidance
export type OrganizationSize = "micro" | "small" | "medium" | "large" | "enterprise";

// Geography types for authoritative sources
export type SCFGeography = "General" | "US" | "EMEA" | "APAC" | "Americas";

// SCF domain categories
export const SCF_DOMAINS = [
  "AAT", // Artificial and Autonomous Technology
  "AST", // Asset Management
  "BCD", // Business Continuity & Disaster Recovery
  "CAP", // Capacity & Performance Planning
  "CHG", // Change Management
  "CLD", // Cloud Security
  "CPL", // Compliance
  "CFG", // Configuration Management
  "MON", // Continuous Monitoring
  "CRY", // Cryptographic Protections
  "DCH", // Data Classification & Handling
  "EMB", // Embedded Technology
  "END", // Endpoint Security
  "GOV", // Governance
  "HRS", // Human Resources Security
  "IAC", // Identification & Authentication
  "IRO", // Incident Response
  "IAO", // Information Assurance
  "MNT", // Maintenance
  "MDM", // Mobile Device Management
  "NET", // Network Security
  "PES", // Physical & Environmental Security
  "PRI", // Data Privacy
  "PRM", // Project & Resource Management
  "RSK", // Risk Management
  "SEA", // Secure Engineering & Architecture
  "OPS", // Security Operations
  "SAT", // Security Awareness & Training
  "TDA", // Technology Development & Acquisition
  "TPM", // Third-Party Management
  "THR", // Threat Management
  "VPM", // Vulnerability & Patch Management
  "WEB", // Web Security
] as const;

export type SCFDomainCode = (typeof SCF_DOMAINS)[number];
