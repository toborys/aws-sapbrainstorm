import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { ok, unauthorized, notFound, serverError } from '../lib/response.js';

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();

    try {
      await verifyTeamToken(token);
    } catch {
      return unauthorized('Team access required');
    }

    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: 'RESULTS#CURRENT', SK: 'METADATA' },
      }),
    );

    if (!result.Item) return notFound('No results available yet');

    return ok(result.Item);
  } catch (err) {
    console.error('votes-results error', err);
    return serverError('Failed to get results');
  }
};
