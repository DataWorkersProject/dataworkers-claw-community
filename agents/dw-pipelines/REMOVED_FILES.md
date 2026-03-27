# Removed Files

## Phase 0
- `src/llm/llm-client.ts` — Custom LLMClient with incompatible API (getTotalTokensUsed vs getTotalSpend). Replaced by core ILLMClient.
- `src/llm/model-router.ts` — ModelRouter for task→model routing. Never called from any handler.
- `src/llm/rag-retriever.ts` — RAGPipelineRetriever for example retrieval. Returns empty array. Never called.
