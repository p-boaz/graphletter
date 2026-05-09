export interface ArtifactCatalogEntry {
  artifact: string;
  erlId: string;
}

export interface ClassifyRequest {
  filename: string;
  mimeType?: string;
}

export type ClassifierConfidence = "high" | "medium" | "low";

export interface ClassifyResponse {
  artifact: string | null;
  erlId: string | null;
  confidence: ClassifierConfidence;
  reasoning: string;
}
