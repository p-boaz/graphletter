// AI SDK Configuration for Compliance Platform

import { createLogger } from "./logger";

const log = createLogger("lib/ai-config");

export const AI_PROVIDERS = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
  OLLAMA: "ollama",
} as const;

export type AIProvider = (typeof AI_PROVIDERS)[keyof typeof AI_PROVIDERS];

export const AI_MODELS = {
  // OpenAI Models
  GPT_5_4: "gpt-5.4",

  // Anthropic Models
  CLAUDE_3_7_SONNET: "claude-3-7-sonnet-latest",
  CLAUDE_3_HAIKU: "claude-3-haiku-20240307",

  // Local/OpenAI-compatible Models
  OLLAMA_LLAMA_3_1_8B: "llama3.1:8b",
} as const;

export type AIModel = (typeof AI_MODELS)[keyof typeof AI_MODELS] | (string & {});

function resolveConfiguredProvider(
  environmentVariables: string[],
  fallback: AIProvider
): AIProvider {
  for (const environmentVariable of environmentVariables) {
    const configuredProvider = process.env[environmentVariable]?.trim().toLowerCase();
    if (!configuredProvider) continue;

    if (Object.values(AI_PROVIDERS).includes(configuredProvider as AIProvider)) {
      return configuredProvider as AIProvider;
    }

    log.warn("ai_config.invalid_provider", {
      detail: `${environmentVariable}=${configuredProvider} is not supported; using ${fallback}`,
    });
  }

  return fallback;
}

function resolveConfiguredModel(environmentVariables: string[], fallback: AIModel): AIModel {
  for (const environmentVariable of environmentVariables) {
    const configuredModel = process.env[environmentVariable]?.trim();
    if (configuredModel) {
      return configuredModel as AIModel;
    }
  }

  return fallback;
}

function resolveControlMappingProvider(): AIProvider {
  return resolveConfiguredProvider(
    ["CONTROL_MAPPING_AI_PROVIDER", "AI_PROVIDER"],
    AI_PROVIDERS.OPENAI
  );
}

function resolveControlMappingModel(provider: AIProvider): AIModel {
  if (provider === AI_PROVIDERS.OLLAMA) {
    return resolveConfiguredModel(
      ["CONTROL_MAPPING_AI_MODEL", "AI_MODEL", "OLLAMA_MODEL"],
      AI_MODELS.OLLAMA_LLAMA_3_1_8B
    );
  }

  if (provider === AI_PROVIDERS.ANTHROPIC) {
    return resolveConfiguredModel(
      ["CONTROL_MAPPING_AI_MODEL", "AI_MODEL", "ANTHROPIC_MODEL_CONTROL_MAPPING"],
      AI_MODELS.CLAUDE_3_7_SONNET
    );
  }

  return resolveConfiguredModel(
    ["CONTROL_MAPPING_AI_MODEL", "AI_MODEL", "OPENAI_MODEL_CONTROL_MAPPING"],
    AI_MODELS.GPT_5_4
  );
}

export function resolveComplianceAIConfig() {
  const provider = resolveControlMappingProvider();

  // Default configuration for compliance analysis
  return {
    // Primary model for control mapping/classification
    controlMapping: {
      provider,
      model: resolveControlMappingModel(provider),
      temperature: 0.1, // Low temperature for consistent analysis
      maxTokens: 2000,
    },

    // Model for gap analysis and recommendations
    gapAnalysis: {
      provider: AI_PROVIDERS.ANTHROPIC,
      model: AI_MODELS.CLAUDE_3_7_SONNET,
      temperature: 0.2,
      maxTokens: 3000,
    },

    // Model for document parsing and ingestion
    documentParsing: {
      provider: AI_PROVIDERS.OPENAI,
      model: resolveConfiguredModel(["OPENAI_MODEL_DOCUMENT_PARSING"], AI_MODELS.GPT_5_4),
      temperature: 0,
      maxTokens: 4000,
    },

    // Model for remediation recommendations
    recommendations: {
      provider: AI_PROVIDERS.ANTHROPIC,
      model: AI_MODELS.CLAUDE_3_7_SONNET,
      temperature: 0.2,
      maxTokens: 1500,
    },
  } as const;
}

export const COMPLIANCE_AI_CONFIG = resolveComplianceAIConfig();

const OPENAI_REASONING_MODEL_PREFIXES = ["gpt-5", "o1", "o3", "o4", "o5"];

export function isOpenAIReasoningModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return OPENAI_REASONING_MODEL_PREFIXES.some(
    (prefix) =>
      normalized === prefix ||
      normalized.startsWith(`${prefix}-`) ||
      normalized.startsWith(`${prefix}.`)
  );
}

export function getTemperatureSettings(
  provider: AIProvider,
  model: string,
  temperature: number | undefined
): { temperature?: number } {
  if (typeof temperature !== "number") {
    return {};
  }

  // Reasoning models do not support temperature in OpenAI/AI SDK.
  if (provider === AI_PROVIDERS.OPENAI && isOpenAIReasoningModel(model)) {
    return {};
  }

  return { temperature };
}

type OpenAIReasoningEffort = "minimal" | "low" | "medium" | "high";
type OpenAITextVerbosity = "low" | "medium" | "high";

interface OpenAIProviderOptionOverrides {
  reasoningEffort?: OpenAIReasoningEffort;
  textVerbosity?: OpenAITextVerbosity;
  strictJsonSchema?: boolean;
  promptCacheKey?: string;
  promptCacheRetention?: "24h";
}

export function getOpenAIProviderOptions(
  provider: AIProvider,
  options: OpenAIProviderOptionOverrides = {}
): {
  providerOptions?: {
    openai: {
      reasoningEffort?: OpenAIReasoningEffort;
      textVerbosity?: OpenAITextVerbosity;
      strictJsonSchema?: boolean;
      promptCacheKey?: string;
      promptCacheRetention?: "24h";
    };
  };
} {
  if (provider !== AI_PROVIDERS.OPENAI) {
    return {};
  }

  const openaiOptions: {
    reasoningEffort?: OpenAIReasoningEffort;
    textVerbosity?: OpenAITextVerbosity;
    strictJsonSchema?: boolean;
    promptCacheKey?: string;
    promptCacheRetention?: "24h";
  } = {};

  if (options.reasoningEffort) {
    openaiOptions.reasoningEffort = options.reasoningEffort;
  }
  if (options.textVerbosity) {
    openaiOptions.textVerbosity = options.textVerbosity;
  }
  if (typeof options.strictJsonSchema === "boolean") {
    openaiOptions.strictJsonSchema = options.strictJsonSchema;
  }
  if (options.promptCacheKey) {
    openaiOptions.promptCacheKey = options.promptCacheKey;
  }
  if (options.promptCacheRetention) {
    openaiOptions.promptCacheRetention = options.promptCacheRetention;
  }

  if (Object.keys(openaiOptions).length === 0) {
    return {};
  }

  return {
    providerOptions: {
      openai: openaiOptions,
    },
  };
}

// Environment variable validation with detailed logging
export function validateAIEnvironment() {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const ollamaAvailable = isOllamaConfigured();

  log.info("AI environment check", {
    hasOpenAI: openaiKey ? "true" : "false",
    hasAnthropic: anthropicKey ? "true" : "false",
    hasOllama: ollamaAvailable ? "true" : "false",
  });

  if (!openaiKey && !anthropicKey && !ollamaAvailable) {
    log.error("ai_config.no_providers_configured", {
      detail:
        "No AI providers configured. Please add OPENAI_API_KEY, ANTHROPIC_API_KEY, or configure Ollama",
    });
    return false;
  }

  if (!openaiKey) {
    log.warn("ai_config.openai_not_configured", {
      detail: "OpenAI not configured. Some features may be limited.",
    });
  }

  if (!anthropicKey) {
    log.warn("ai_config.anthropic_not_configured", {
      detail: "Anthropic not configured. Some features may be limited.",
    });
  }

  if (!ollamaAvailable && COMPLIANCE_AI_CONFIG.controlMapping.provider === AI_PROVIDERS.OLLAMA) {
    log.warn("ai_config.ollama_not_configured", {
      detail: "Ollama selected but OLLAMA_BASE_URL is not configured.",
    });
  }

  return true;
}

export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434/v1";
}

export function getOllamaApiKey(): string {
  return process.env.OLLAMA_API_KEY?.trim() || "ollama";
}

function isOllamaConfigured(): boolean {
  return (
    resolveControlMappingProvider() === AI_PROVIDERS.OLLAMA ||
    Boolean(process.env.OLLAMA_BASE_URL?.trim())
  );
}

// Get available providers based on environment variables
export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = [];

  if (process.env.OPENAI_API_KEY) providers.push(AI_PROVIDERS.OPENAI);
  if (process.env.ANTHROPIC_API_KEY) providers.push(AI_PROVIDERS.ANTHROPIC);
  if (isOllamaConfigured()) providers.push(AI_PROVIDERS.OLLAMA);

  return providers;
}

// Get fallback provider if primary is not available
export function getFallbackProvider(primaryProvider: AIProvider): AIProvider | null {
  const available = getAvailableProviders();

  if (available.includes(primaryProvider)) {
    return primaryProvider;
  }

  // Return first available provider as fallback
  return available.length > 0 ? available[0] : null;
}

// Get API keys for providers
export function getProviderConfig() {
  return {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      available: !!process.env.OPENAI_API_KEY,
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      available: !!process.env.ANTHROPIC_API_KEY,
    },
    ollama: {
      apiKey: getOllamaApiKey(),
      baseURL: getOllamaBaseUrl(),
      available: isOllamaConfigured(),
    },
  };
}
