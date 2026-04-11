import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyCustomerToken, verifyTeamToken } from '../lib/auth.js';
import { ok, unauthorized, serverError } from '../lib/response.js';

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();

    let isTeam = false;
    try {
      await verifyTeamToken(token);
      isTeam = true;
    } catch {
      try {
        await verifyCustomerToken(token);
      } catch {
        return unauthorized('Invalid token');
      }
    }

    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'IDEA#',
          ':sk': 'METADATA',
        },
      }),
    );

    let ideas = result.Items || [];

    // Customers only see active ideas
    if (!isTeam) {
      ideas = ideas.filter((item) => item.status === 'active');
    }

    // Sort by order field
    ideas.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));

    return ok(ideas);
  } catch (err) {
    console.error('ideas-list error', err);
    return serverError('Failed to list ideas');
  }
};
