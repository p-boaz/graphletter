# Intelligent Evidence Classification System

## Overview

This directory contains a systematic, reusable framework for classifying evidence artifacts and mapping them to appropriate SCF Evidence Request List (ERL) artifacts. It replaces hardcoded artifact mappings with intelligent schema-based analysis.

## Architecture

### Core Components

1. **`evidence-classifier.ts`** - Schema-based classification engine
2. **`erl-mapping-engine.ts`** - Intelligent ERL selection based on evidence capabilities
3. **`evidence-processor.ts`** - Main orchestrator replacing `processEvidenceViaERL`
4. **`types.ts`** - TypeScript definitions

## Key Benefits

### Before (Hardcoded Approach)

```typescript
// Naive hardcoded mapping
artifact = await getArtifactByName("Cryptographic Protections");
await processEvidenceViaERL(userId, connectionId, artifact.documentation_artifact, ...);
```

### After (Intelligent Analysis)

```typescript
// Systematic evidence analysis
await EvidenceProcessor.processEvidence(
  userId,
  connectionId,
  evidenceData,
  dataSource,
  checkType,
  processedContent,
  supabase,
  evidenceRecords,
  assessments,
  sessionId
);
```

## What This System Does

1. **🔍 Schema Analysis**: Examines evidence structure to determine artifact type
2. **🎯 Intelligent Mapping**: Maps to best-fit ERL based on what evidence actually proves
3. **📊 Coverage Analysis**: Calculates coverage ratios (e.g., 1/13 buckets = 7.7%)
4. **🔍 Gap Identification**: Identifies missing evidence and suggests collections
5. **📋 Machine-Readable Output**: Generates structured analysis for reporting

## ERL Mappings

From the real ERL database, the system correctly maps:

- **S3 Encryption** → `E-CRY-01` "Cryptographic Protections"
- **S3 Public Access** → `E-IAM-01` "Access Permission Review"
- **IAM MFA** → `E-IAM-05` "Identity & Access Management (IAM) Function"
- **Password Policy** → `E-IAM-06` "Authenticate, Authorize and Audit (AAA) Solution"

## Implementation Status

✅ **Implemented and Integrated**

- AWS services route updated to use intelligent processing
- S3 and IAM evidence now processed via `EvidenceProcessor.processEvidence()`
- Schema-based classification working for all AWS evidence types
- Azure and GCP classifier methods return deterministic storage, identity, and
  password-policy classifications with structured manual-review fallbacks

## Example Output

The system generates machine-readable analysis like:

```json
{
  "artifact_classification": {
    "assigned_erl_id": "E-CRY-01",
    "erl_name": "Cryptographic Protections",
    "reason": "Direct evidence of encryption at rest implementation",
    "confidence": 0.95
  },
  "evidence_observation": {
    "check_type": "s3_encryption",
    "total_buckets": 13,
    "buckets_with_encryption": 1,
    "coverage_ratio": 0.077
  },
  "control_assessment_from_this_artifact": [
    {
      "control": "CRY-05",
      "status": "partial",
      "basis": "1/13 buckets encrypted by default",
      "coverage_ratio": 0.077
    }
  ],
  "suggested_additional_artifacts": [
    {
      "erl_id": "E-CRY-02",
      "name": "Cryptographic Key Management",
      "reason": "Key management policies not evidenced"
    }
  ],
  "gaps_identified": [
    {
      "gap_type": "incomplete_coverage",
      "description": "12 resources lack encryption",
      "suggested_artifacts": ["AWS Config Rules", "IaC templates"],
      "priority": "high"
    }
  ]
}
```

## Extensibility

This framework easily extends to any evidence type:

- **Azure/GCP**: Expand rules as new check types are collected
- **GitHub**: Add `classifyGitHubEvidence()` rules
- **Manual uploads**: Add classification for document types

## Integration

The system is now active in:

- `/app/api` automation endpoints - Uses intelligent processing for IAM and S3 evidence

## Result

Instead of false confidence from oversimplified mappings, users get:

- ✅ **Precise Coverage Analysis**: "1/13 buckets encrypted (7.7% coverage)"
- ✅ **Nuanced Control Assessment**: "partial", "insufficient", "complete"
- ✅ **Gap Identification**: "Key management policies not evidenced"
- ✅ **Actionable Recommendations**: "Collect E-CRY-02 artifacts"

This transforms the platform from **evidence bucket-sorting** to **evidence intelligence** - exactly what compliance professionals need for real decision-making.
