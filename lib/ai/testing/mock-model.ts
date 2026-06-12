/**
 * Shared mock helpers for AI pipeline tests.
 *
 * NOTE: ai/test cannot be imported directly because its barrel
 * (ai/dist/test/index.mjs) re-exports from @ai-sdk/provider-utils/test
 * which requires the `msw` peer dependency — not installed in this project.
 * MockLanguageModelV2 below is a faithful transcription of the class shipped
 * in ai@5.0.115's `./test` export, with the same constructor signature.
 * Shape verified against @ai-sdk/provider@2.0.0 LanguageModelV2 interface.
 */

import type { LanguageModel } from "ai";
import { setModelFactoryForTesting } from "@/lib/ai-client";
import type { AIProvider, AIModel } from "@/lib/ai-config";

/**
 * LanguageModelV2 is the concrete interface that LanguageModel resolves to
 * at runtime (GlobalProviderModelId | LanguageModelV2). We use LanguageModel
 * throughout so we don't need to reference @ai-sdk/provider directly.
 */
type LMV2 = Extract<LanguageModel, { specificationVersion: "v2" }>;
type DoGenerateOptions = Parameters<LMV2["doGenerate"]>[0];
type DoStreamOptions = Parameters<LMV2["doStream"]>[0];

// ---------------------------------------------------------------------------
// Minimal doGenerate result type (mirrors LanguageModelV2['doGenerate'] return)
// ---------------------------------------------------------------------------

type DoGenerateResult = Awaited<ReturnType<LMV2["doGenerate"]>>;

function notImplemented(): never {
  throw new Error("MockLanguageModelV2: not implemented");
}

// ---------------------------------------------------------------------------
// MockLanguageModelV2
// Transcribed from ai@5.0.115's `./test` export (same constructor shape).
// ---------------------------------------------------------------------------

export class MockLanguageModelV2 implements LMV2 {
  readonly specificationVersion = "v2" as const;
  readonly provider: string;
  readonly modelId: string;
  doGenerate: LMV2["doGenerate"];
  doStream: LMV2["doStream"];
  readonly doGenerateCalls: DoGenerateOptions[] = [];
  readonly doStreamCalls: DoStreamOptions[] = [];
  readonly supportedUrls: LMV2["supportedUrls"] = {};

  constructor({
    provider = "mock-provider",
    modelId = "mock-model-id",
    doGenerate = notImplemented as unknown as LMV2["doGenerate"],
    doStream = notImplemented as unknown as LMV2["doStream"],
  }: {
    provider?: string;
    modelId?: string;
    doGenerate?: LMV2["doGenerate"] | DoGenerateResult | DoGenerateResult[];
    doStream?: LMV2["doStream"];
  } = {}) {
    this.provider = provider;
    this.modelId = modelId;

    this.doGenerate = async (options: DoGenerateOptions) => {
      this.doGenerateCalls.push(options);
      if (typeof doGenerate === "function") {
        return (doGenerate as LMV2["doGenerate"])(options);
      } else if (Array.isArray(doGenerate)) {
        const result = (doGenerate as DoGenerateResult[])[this.doGenerateCalls.length - 1];
        if (!result) throw new Error("MockLanguageModelV2: no more canned results");
        return result;
      } else {
        return doGenerate as DoGenerateResult;
      }
    };

    this.doStream = async (options: DoStreamOptions) => {
      this.doStreamCalls.push(options);
      if (typeof doStream === "function") {
        return (doStream as LMV2["doStream"])(options);
      }
      throw new Error("MockLanguageModelV2: doStream not configured");
    };
  }
}

// ---------------------------------------------------------------------------
// Helper: build a minimal doGenerate result that wraps a JSON object
// as a text content item (what generateObject expects in AI SDK v5).
// ---------------------------------------------------------------------------

function makeTextResult(obj: unknown): DoGenerateResult {
  return {
    content: [{ type: "text", text: JSON.stringify(obj) }],
    finishReason: "stop",
    usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// mockObjectModel
//
// Returns a MockLanguageModelV2 whose doGenerate yields each canned object
// in sequence (wrapped as JSON text for generateObject to parse).
// After the list is exhausted, throws.
// ---------------------------------------------------------------------------

export function mockObjectModel(objects: unknown[] | (() => unknown)): MockLanguageModelV2 {
  if (typeof objects === "function") {
    const factory = objects;
    return new MockLanguageModelV2({
      doGenerate: async (_opts: DoGenerateOptions) => makeTextResult(factory()),
    });
  }

  const items = [...objects];
  let idx = 0;
  return new MockLanguageModelV2({
    doGenerate: async (_opts: DoGenerateOptions) => {
      if (idx >= items.length) {
        throw new Error(`mockObjectModel: exhausted after ${items.length} calls`);
      }
      return makeTextResult(items[idx++]);
    },
  });
}

// ---------------------------------------------------------------------------
// failingModel
//
// Fails failCount times with `error`, then succeeds returning `then`.
// ---------------------------------------------------------------------------

export function failingModel(error: Error, failCount: number, then: unknown): MockLanguageModelV2 {
  let calls = 0;
  return new MockLanguageModelV2({
    doGenerate: async (_opts: DoGenerateOptions) => {
      calls += 1;
      if (calls <= failCount) throw error;
      return makeTextResult(then);
    },
  });
}

// ---------------------------------------------------------------------------
// hangingModel
//
// doGenerate never resolves (used to exercise timeout paths).
// Pass an AbortSignal to make it reject on abort.
// ---------------------------------------------------------------------------

export function hangingModel(signal?: AbortSignal): MockLanguageModelV2 {
  return new MockLanguageModelV2({
    doGenerate: (_opts: DoGenerateOptions) =>
      new Promise<DoGenerateResult>((_resolve, reject) => {
        if (signal) {
          signal.addEventListener("abort", () =>
            reject(new Error("AbortError: model call aborted"))
          );
        }
        // never resolves otherwise
      }),
  });
}

// ---------------------------------------------------------------------------
// installMockModel / resetMockModel
//
// Thin wrappers around setModelFactoryForTesting.
// Usage: call installMockModel in beforeEach, resetMockModel in afterEach.
// ---------------------------------------------------------------------------

export function installMockModel(model: MockLanguageModelV2): void {
  setModelFactoryForTesting((_provider: AIProvider, _model: AIModel) => model);
}

export function resetMockModel(): void {
  setModelFactoryForTesting(null);
}
