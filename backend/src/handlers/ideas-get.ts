import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyCustomerToken, verifyTeamToken } from '../lib/auth.js';
import { ok, unauthorized, notFound, serverError } from '../lib/response.js';

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();

    try {
      await verifyTeamToken(token);
    } catch {
      try {
        await verifyCustomerToken(token);
      } catch {
        return unauthorized('Invalid token');
      }
    }

    const id = event.pathParameters?.id;
    if (!id) return notFound('Idea id is required');

    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `IDEA#${id}`, SK: 'METADATA' },
      }),
    );

    if (!result.Item) return notFound('Idea not found');

    return ok(result.Item);
  } catch (err) {
    console.error('ideas-get error', err);
    return serverError('Failed to get idea');
  }
};
