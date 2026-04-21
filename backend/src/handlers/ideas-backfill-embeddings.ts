/**
 * Backfill Titan embeddings for ideas that predate the dedupe feature.
 *
 * Scan every IDEA#/METADATA record, skip those that already have an
 * `embedding` attribute, and for the rest generate a fresh embedding via
 * Bedrock and UpdateItem the record in place.
 *
 * Rate-limiting: Bedrock has per-account TPS limits for Titan embed. We
 * process in batches of 5 with a 500ms pause between batches — comfortably
 * under the default soft limit and enough to keep Lambda runtime bounded
 * for realistic portfolio sizes (low thousands at most).
 */

import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { ok, unauthorized, serverError } from '../lib/response.js';
import { generateEmbedding, extractIdeaText } from '../lib/embeddings.js';

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500;

interface IdeaRow {
  id: string;
  name?: string;
  tagline?: string;
  problem?: string;
  hasEmbedding: boolean;
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();

    try {
      await verifyTeamToken(token);
    } catch {
      return unauthorized('Team access required');
    }

    const ideas = await scanAllIdeas();

    const missing = ideas.filter((i) => !i.hasEmbedding);
    const alreadyHadEmbedding = ideas.length - missing.length;
    const failed: Array<{ id: string; error: string }> = [];
    let backfilled = 0;

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (idea) => {
          try {
            const text = extractIdeaText({
              name: idea.name,
              tagline: idea.tagline,
              problem: idea.problem,
            });
            if (!text) {
              failed.push({ id: idea.id, error: 'no embeddable text' });
              return;
            }
            const embedding = await generateEmbedding(text);
            await ddb.send(
              new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { PK: `IDEA#${idea.id}`, SK: 'METADATA' },
                UpdateExpression: 'SET embedding = :e',
                ExpressionAttributeValues: {
                  ':e': embedding,
                },
              }),
            );
            backfilled++;
          } catch (err) {
            failed.push({
              id: idea.id,
              error: (err as Error)?.message || 'unknown error',
            });
          }
        }),
      );
      // Only sleep if there's another batch coming.
      if (i + BATCH_SIZE < missing.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    return ok({
      total: ideas.length,
      backfilled,
      alreadyHadEmbedding,
      failed,
    });
  } catch (err) {
    console.error('ideas-backfill-embeddings error', err);
    return serverError('Failed to backfill embeddings');
  }
};

async function scanAllIdeas(): Promise<IdeaRow[]> {
  const results: IdeaRow[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined = undefined;

  do {
    const res: {
      Items?: Array<Record<string, unknown>>;
      LastEvaluatedKey?: Record<string, unknown>;
    } = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'IDEA#',
          ':sk': 'METADATA',
        },
        ProjectionExpression: 'id, #n, tagline, problem, embedding',
        ExpressionAttributeNames: { '#n': 'name' },
        ExclusiveStartKey,
      }),
    );
    for (const raw of res.Items || []) {
      results.push({
        id: String(raw.id || ''),
        name: typeof raw.name === 'string' ? raw.name : undefined,
        tagline: typeof raw.tagline === 'string' ? raw.tagline : undefined,
        problem: typeof raw.problem === 'string' ? raw.problem : undefined,
        hasEmbedding: Array.isArray(raw.embedding) && (raw.embedding as unknown[]).length > 0,
      });
    }
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return results;
}
