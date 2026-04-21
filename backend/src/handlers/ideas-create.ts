import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { created, badRequest, unauthorized, conflict, serverError } from '../lib/response.js';
import { mirrorIdeaToKnowledgeBase } from '../lib/knowledge-base.js';
import {
  generateEmbedding,
  cosineSimilarity,
  extractIdeaText,
  DUPLICATE_THRESHOLD,
} from '../lib/embeddings.js';

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();

    let userId: string;
    try {
      const payload = await verifyTeamToken(token);
      userId = payload.sub;
    } catch {
      return unauthorized('Team access required');
    }

    const body = JSON.parse(event.body || '{}');
    const { name, category } = body;

    if (!name || !category) {
      return badRequest('name and category are required');
    }

    const force = event.queryStringParameters?.force === 'true';

    const id = body.id || randomUUID();
    const now = new Date().toISOString();

    // --- Embedding for dedupe -----------------------------------------------
    // Generate a Titan embedding for the new idea up front so we can both
    // (a) compare against existing ideas and (b) persist it with the record
    // for future duplicate checks.
    //
    // If Bedrock fails for any reason, we log and fall through — the feature
    // is protective, not load-bearing. Saving the idea always wins over
    // dedupe accuracy; we do not want a transient Bedrock outage to block
    // data entry.
    const embeddingInput = extractIdeaText({
      name,
      tagline: body.tagline,
      problem: body.problem,
    });

    let newEmbedding: number[] | null = null;
    try {
      if (embeddingInput) {
        newEmbedding = await generateEmbedding(embeddingInput);
      }
    } catch (embedErr) {
      console.error('ideas-create: embedding generation failed (non-fatal)', embedErr);
    }

    // --- Duplicate check ----------------------------------------------------
    // Only run if we have a fresh embedding AND the caller hasn't explicitly
    // opted out via ?force=true.
    if (newEmbedding && !force) {
      try {
        const existing = await scanIdeasWithEmbeddings();
        let best: { id: string; name: string; tagline: string; similarity: number } | null = null;
        for (const item of existing) {
          const sim = cosineSimilarity(newEmbedding, item.embedding);
          if (!best || sim > best.similarity) {
            best = {
              id: item.id,
              name: item.name,
              tagline: item.tagline,
              similarity: sim,
            };
          }
        }
        if (best && best.similarity >= DUPLICATE_THRESHOLD) {
          return conflict({
            error: 'duplicate',
            message: 'This idea appears similar to an existing one.',
            similarity: best.similarity,
            existingIdea: {
              id: best.id,
              name: best.name,
              tagline: best.tagline,
            },
            hint: 'Use ?force=true to save anyway',
          });
        }
      } catch (scanErr) {
        // Never let a dedupe scan failure block a save — log and proceed.
        console.error('ideas-create: dedupe scan failed (non-fatal)', scanErr);
      }
    }

    const item: Record<string, unknown> = {
      PK: `IDEA#${id}`,
      SK: 'METADATA',
      GSI1PK: `CATEGORY#${category}`,
      GSI1SK: `IDEA#${id}`,
      id,
      name,
      tagline: body.tagline || '',
      problem: body.problem || '',
      solution: body.solution || '',
      architecture: body.architecture || '',
      awsServices: body.awsServices || [],
      complexity: body.complexity || 'medium',
      mvpTime: body.mvpTime || '',
      risk: body.risk || 'medium',
      riskNote: body.riskNote || '',
      mrr: body.mrr || '',
      model: body.model || '',
      selfService: body.selfService ?? true,
      potential: body.potential || 'medium',
      category,
      categoryGroup: body.categoryGroup || 'technical',
      categoryType: body.categoryType || 'technical',
      targetBuyer: body.targetBuyer || '',
      customerPerspective: body.customerPerspective || '',
      differentiator: body.differentiator || '',
      championedBy: body.championedBy || [],
      challengedBy: body.challengedBy || [],
      panelNotes: body.panelNotes || '',
      architectureDiagram: body.architectureDiagram || '',
      sapModules: body.sapModules || [],
      status: body.status || 'active',
      order: body.order ?? 0,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
    };

    // Optional nested / scalar fields — only persist if supplied
    if (body.costEstimate !== undefined) {
      item.costEstimate = body.costEstimate;
    }
    if (body.sourceSessionId !== undefined) {
      item.sourceSessionId = body.sourceSessionId;
    }

    // Persist the embedding alongside the idea so future dedupe scans can
    // skip regeneration.
    if (newEmbedding) {
      item.embedding = newEmbedding;
    }

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      }),
    );

    // Mirror to Knowledge Base (S3) — non-fatal, runs in background
    // Every idea saved to portfolio becomes durable R&D material
    await mirrorIdeaToKnowledgeBase(item as { id: string; name: string; category: string });

    // Strip embedding from response payload — no need to ship ~4KB of floats
    // to the browser on every create.
    const { embedding: _embedding, ...responseItem } = item as { embedding?: number[] } & Record<string, unknown>;
    return created(responseItem);
  } catch (err) {
    console.error('ideas-create error', err);
    return serverError('Failed to create idea');
  }
};

/**
 * Scan all IDEA#/METADATA records that already have an `embedding`
 * attribute. Uses a filter expression with `attribute_exists` so we avoid
 * shipping ideas without embeddings (which would cost DDB reads for no
 * benefit — they can't be compared anyway).
 *
 * DDB Scan pagination: idea portfolios are small (<1000 items) for the
 * foreseeable future; we still page defensively.
 */
async function scanIdeasWithEmbeddings(): Promise<
  Array<{ id: string; name: string; tagline: string; embedding: number[] }>
> {
  const results: Array<{ id: string; name: string; tagline: string; embedding: number[] }> = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined = undefined;

  do {
    const res: {
      Items?: Array<Record<string, unknown>>;
      LastEvaluatedKey?: Record<string, unknown>;
    } = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression:
          'begins_with(PK, :pk) AND SK = :sk AND attribute_exists(embedding)',
        ExpressionAttributeValues: {
          ':pk': 'IDEA#',
          ':sk': 'METADATA',
        },
        ProjectionExpression: 'id, #n, tagline, embedding',
        ExpressionAttributeNames: {
          '#n': 'name',
        },
        ExclusiveStartKey,
      }),
    );
    for (const raw of res.Items || []) {
      const emb = raw.embedding;
      if (Array.isArray(emb) && emb.length > 0) {
        results.push({
          id: String(raw.id || ''),
          name: String(raw.name || ''),
          tagline: String(raw.tagline || ''),
          embedding: emb as number[],
        });
      }
    }
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return results;
}
