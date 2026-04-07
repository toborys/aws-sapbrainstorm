import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { created, badRequest, unauthorized, serverError } from '../lib/response.js';

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
    const { title, description, category } = body;

    if (!title || !description || !category) {
      return badRequest('title, description, and category are required');
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    const item = {
      PK: `IDEA#${id}`,
      SK: 'METADATA',
      GSI1PK: `CATEGORY#${category}`,
      GSI1SK: `IDEA#${id}`,
      id,
      title,
      description,
      category,
      status: 'active',
      order: body.order ?? 0,
      tags: body.tags ?? [],
      effort: body.effort,
      impact: body.impact,
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      }),
    );

    return created(item);
  } catch (err) {
    console.error('ideas-create error', err);
    return serverError('Failed to create idea');
  }
};
