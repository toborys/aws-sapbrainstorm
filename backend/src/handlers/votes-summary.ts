import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyCustomerToken } from '../lib/auth.js';
import { ok, unauthorized, notFound, serverError } from '../lib/response.js';

type AggregatedIdea = {
  ideaId: string;
  title?: string;
  category?: string;
  voteCount: number;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();

    try {
      await verifyCustomerToken(token);
    } catch {
      return unauthorized('Customer access required');
    }

    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: 'RESULTS#CURRENT', SK: 'METADATA' },
      }),
    );

    if (!result.Item) return notFound('No results available yet');

    // results-aggregator writes: { ideas: [{ ideaId, title, category, voteCount }], totalVotes, uniqueVoters, updatedAt }
    const fullResults = result.Item;
    const ideaArr: AggregatedIdea[] = Array.isArray(fullResults.ideas) ? fullResults.ideas : [];

    // Take top 5 by voteCount (aggregator already sorts, but re-sort defensively)
    const topSorted = [...ideaArr]
      .sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
      .slice(0, 5);

    // Enrich any entries missing a title by fetching idea metadata
    const missingTitleIds = topSorted
      .filter((i) => !i.title || i.title === 'Unknown')
      .map((i) => i.ideaId);

    const nameById: Record<string, string> = {};
    if (missingTitleIds.length > 0) {
      const batch = await ddb.send(
        new BatchGetCommand({
          RequestItems: {
            [TABLE_NAME]: {
              Keys: missingTitleIds.map((id) => ({ PK: `IDEA#${id}`, SK: 'METADATA' })),
            },
          },
        }),
      );
      const items = batch.Responses?.[TABLE_NAME] || [];
      for (const item of items) {
        if (item.id && item.name) {
          nameById[item.id as string] = item.name as string;
        }
      }
    }

    const topIdeas = topSorted.map((idea) => ({
      id: idea.ideaId,
      name: idea.title && idea.title !== 'Unknown' ? idea.title : nameById[idea.ideaId] ?? 'Unknown',
      voteCount: idea.voteCount ?? 0,
    }));

    return ok({
      totalVotes: fullResults.totalVotes ?? 0,
      topIdeas,
      updatedAt: fullResults.updatedAt,
    });
  } catch (err) {
    console.error('votes-summary error', err);
    return serverError('Failed to get summary');
  }
};
