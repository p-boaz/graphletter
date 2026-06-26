# AI Provider Configuration

Graphletter routes AI calls through `lib/ai-client.ts`. Application code asks
for a provider/model pair with `getModel(provider, model)`; that function owns
provider construction, fallback selection, and local-provider wiring.

## Provider seam

`lib/ai-config.ts` is the source of truth for provider names, default models,
environment overrides, and provider availability.

The assessment path uses `COMPLIANCE_AI_CONFIG.controlMapping`. Set
`AI_PROVIDER=ollama` or `CONTROL_MAPPING_AI_PROVIDER=ollama` to route assessment
calls to a local OpenAI-compatible endpoint. `CONTROL_MAPPING_AI_PROVIDER` is
more specific and wins over `AI_PROVIDER` when both are present.

Current providers:

| Provider    | Runtime adapter                  | Required configuration                         |
| ----------- | -------------------------------- | ---------------------------------------------- |
| `openai`    | `@ai-sdk/openai`                 | `OPENAI_API_KEY`                               |
| `anthropic` | `@ai-sdk/anthropic`              | `ANTHROPIC_API_KEY`                            |
| `ollama`    | `@ai-sdk/openai` chat-compatible | `AI_PROVIDER=ollama`; optional `OLLAMA_*` vars |

## Local Ollama

Ollama exposes an OpenAI-compatible API at `/v1`. The default Graphletter
settings target:

```sh
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_MODEL=llama3.1:8b
```

For Docker Compose on macOS or Docker Desktop, use the host gateway:

```sh
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
OLLAMA_MODEL=llama3.1:8b
```

`OLLAMA_API_KEY` defaults to `ollama` because the local API accepts a bearer
value for OpenAI-compatible clients. Set it only when routing to a protected
OpenAI-compatible gateway.

## Override order

Assessment provider:

1. `CONTROL_MAPPING_AI_PROVIDER`
2. `AI_PROVIDER`
3. `openai`

Assessment model:

1. `CONTROL_MAPPING_AI_MODEL`
2. `AI_MODEL`
3. Provider-specific model variable (`OLLAMA_MODEL`, `OPENAI_MODEL_CONTROL_MAPPING`,
   or `ANTHROPIC_MODEL_CONTROL_MAPPING`)
4. Provider default from `lib/ai-config.ts`

## Limits

Local provider support is text-first. Image evidence still flows through the
same assessment code path, but local vision quality depends on the configured
OpenAI-compatible endpoint and model. Validate a local vision model before
using it for screenshot-based assessments.
