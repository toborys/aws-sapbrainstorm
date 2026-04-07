import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { ok, unauthorized, serverError } from '../lib/response.js';

const GSI1_INDEX = process.env.GSI1_INDEX_NAME || 'GSI1';

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
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: GSI1_INDEX,
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'STATUS#pending',
        },
      }),
    );

    return ok(result.Items || []);
  } catch (err) {
    console.error('admin-custom-ideas error', err);
    return serverError('Failed to get custom ideas');
  }
};
