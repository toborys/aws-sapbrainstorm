/**
 * Titan Embeddings v2 helpers for idea deduplication.
 *
 * Model: amazon.titan-embed-text-v2:0 (available in eu-central-1).
 *   - Accepts up to ~8000 input tokens.
 *   - Returns a 1024-dim float vector.
 *   - With `normalize: true`, vectors are unit-length, so cosine similarity
 *     reduces to a plain dot product — but we still implement the full
 *     formula defensively in case an un-normalized vector slips through.
 *
 * Storage note: 1024 × 4 bytes ~= 4 KB per idea on DDB, well within the
 * 400 KB item size limit.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: 'eu-central-1' });

const EMBED_MODEL_ID = 'amazon.titan-embed-text-v2:0';
const EMBED_DIMENSIONS = 1024;

/**
 * Call Bedrock Titan v2 and return a 1024-dim float vector.
 *
 * Titan returns a normalized vector when `normalize: true`, which means
 * cosine similarity between two vectors equals their dot product.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    throw new Error('generateEmbedding called with empty text');
  }

  const body = JSON.stringify({
    inputText: trimmed,
    dimensions: EMBED_DIMENSIONS,
    normalize: true,
  });

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: EMBED_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(body),
    }),
  );

  const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as {
    embedding?: number[];
  };

  const vector = responseBody.embedding;
  if (!Array.isArray(vector) || vector.length !== EMBED_DIMENSIONS) {
    throw new Error(
      `Titan returned malformed embedding (length=${vector?.length ?? 'n/a'})`,
    );
  }
  return vector;
}

/**
 * Cosine similarity on two equal-length numeric vectors.
 *
 * Returns a value in [-1, 1]. For normalized Titan outputs this reduces
 * to a dot product, but we keep the full form to be robust to any non-
 * normalized vectors (e.g. legacy records, tests, other providers).
 *
 * Returns 0 on length mismatch rather than throwing — the caller is
 * iterating over many candidates and a single malformed record should
 * not abort the whole dedupe scan.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Compact representation of an idea suitable for embedding.
 *
 * We intentionally keep only the semantic core (name + tagline + problem)
 * to:
 *   - keep input well under Titan's 8k-token limit;
 *   - focus similarity on "what problem does this idea address" rather than
 *     on architecture phrasing or AWS service lists (which legitimately
 *     overlap between different ideas);
 *   - make the embedding stable across small architecture/cost revisions.
 *
 * Roughly ~200 tokens for a typical idea.
 */
export function extractIdeaText(idea: {
  name?: string;
  tagline?: string;
  problem?: string;
}): string {
  const parts = [
    idea.name?.trim(),
    idea.tagline?.trim(),
    idea.problem?.trim(),
  ].filter((p): p is string => Boolean(p && p.length > 0));
  return parts.join('\n');
}

export const DUPLICATE_THRESHOLD = 0.85;
