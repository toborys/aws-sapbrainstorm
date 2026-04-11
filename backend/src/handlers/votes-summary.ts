import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyCustomerToken } from '../lib/auth.js';
import { ok, unauthorized, notFound, serverError } from '../lib/response.js';

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

    // Return limited view: only top 5 ideas, no company-level info
    const fullResults = result.Item;
    const topIdeas = Array.isArray(fullResults.ideas)
      ? fullResults.ideas.slice(0, 5).map((idea: any) => ({
          ideaId: idea.ideaId,
          name: idea.title,
          voteCount: idea.voteCount,
        }))
      : [];

    return ok({
      totalVotes: fullResults.totalVotes,
      topIdeas,
      updatedAt: fullResults.updatedAt,
    });
  } catch (err) {
    console.error('votes-summary error', err);
    return serverError('Failed to get summary');
  }
};
