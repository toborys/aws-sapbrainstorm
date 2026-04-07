import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyCustomerToken } from '../lib/auth.js';
import { ok, unauthorized, serverError } from '../lib/response.js';

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();

    let userId: string;
    try {
      const payload = await verifyCustomerToken(token);
      userId = payload.sub;
    } catch {
      return unauthorized('Customer access required');
    }

    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `VOTE#${userId}`,
        },
      }),
    );

    return ok(result.Items || []);
  } catch (err) {
    console.error('votes-my error', err);
    return serverError('Failed to get votes');
  }
};
