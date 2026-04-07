import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyCustomerToken } from '../lib/auth.js';
import { ok, badRequest, unauthorized, serverError } from '../lib/response.js';

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

    const body = JSON.parse(event.body || '{}');
    const { ideaIds, customIdea } = body;

    if (!Array.isArray(ideaIds) || ideaIds.length === 0) {
      return badRequest('ideaIds must be a non-empty array');
    }

    if (ideaIds.length > 5) {
      return badRequest('Maximum 5 ideas allowed');
    }

    const now = new Date().toISOString();
    const transactItems: any[] = [];

    // Create/update VOTE records for each idea
    for (const ideaId of ideaIds) {
      transactItems.push({
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: `VOTE#${userId}`,
            SK: `IDEA#${ideaId}`,
            userId,
            ideaId,
            votedAt: now,
          },
        },
      });
    }

    // Create SESSION record
    transactItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: {
          PK: `VOTE#${userId}`,
          SK: `SESSION#${now}`,
          userId,
          ideaIds,
          customIdea: customIdea || undefined,
          submittedAt: now,
        },
      },
    });

    // Optionally create CUSTOM record
    if (customIdea && typeof customIdea === 'string' && customIdea.trim().length > 0) {
      transactItems.push({
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: `CUSTOM#${userId}`,
            SK: `IDEA#${now}`,
            GSI1PK: 'STATUS#pending',
            GSI1SK: `CUSTOM#${userId}#${now}`,
            userId,
            content: customIdea.trim(),
            status: 'pending',
            createdAt: now,
          },
        },
      });
    }

    await ddb.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      }),
    );

    return ok({ message: 'Votes submitted successfully', ideaIds, customIdea: customIdea || null });
  } catch (err) {
    console.error('votes-submit error', err);
    return serverError('Failed to submit votes');
  }
};
