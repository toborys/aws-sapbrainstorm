import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { ok, badRequest, unauthorized, serverError } from '../lib/response.js';

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();

    try {
      await verifyTeamToken(token);
    } catch {
      return unauthorized('Team access required');
    }

    const body = JSON.parse(event.body || '{}');
    const { orderedIds } = body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return badRequest('orderedIds must be a non-empty array');
    }

    // Update each idea's order field
    const updates = orderedIds.map((id: string, index: number) =>
      ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `IDEA#${id}`, SK: 'METADATA' },
          UpdateExpression: 'SET #order = :order, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#order': 'order',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':order': index,
            ':updatedAt': new Date().toISOString(),
          },
        }),
      ),
    );

    await Promise.all(updates);

    return ok({ message: 'Reorder complete', count: orderedIds.length });
  } catch (err) {
    console.error('ideas-reorder error', err);
    return serverError('Failed to reorder ideas');
  }
};
