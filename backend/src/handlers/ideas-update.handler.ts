import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { ok, badRequest, unauthorized, notFound, serverError } from '../lib/response.js';

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();

    try {
      await verifyTeamToken(token);
    } catch {
      return unauthorized('Team access required');
    }

    const id = event.pathParameters?.id;
    if (!id) return badRequest('Idea id is required');

    const body = JSON.parse(event.body || '{}');
    const allowedFields = ['title', 'description', 'category', 'status', 'order', 'tags', 'effort', 'impact'];

    const expressionParts: string[] = [];
    const expressionNames: Record<string, string> = {};
    const expressionValues: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const attrName = `#${field}`;
        const attrValue = `:${field}`;
        expressionParts.push(`${attrName} = ${attrValue}`);
        expressionNames[attrName] = field;
        expressionValues[attrValue] = body[field];
      }
    }

    if (expressionParts.length === 0) {
      return badRequest('No valid fields to update');
    }

    // Always update updatedAt
    expressionParts.push('#updatedAt = :updatedAt');
    expressionNames['#updatedAt'] = 'updatedAt';
    expressionValues[':updatedAt'] = new Date().toISOString();

    // Update GSI1 keys if category changed
    if (body.category) {
      expressionParts.push('GSI1PK = :gsi1pk');
      expressionValues[':gsi1pk'] = `CATEGORY#${body.category}`;
      expressionParts.push('GSI1SK = :gsi1sk');
      expressionValues[':gsi1sk'] = `IDEA#${id}`;
    }

    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `IDEA#${id}`, SK: 'METADATA' },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
        ConditionExpression: 'attribute_exists(PK)',
        ReturnValues: 'ALL_NEW',
      }),
    );

    if (!result.Attributes) return notFound('Idea not found');

    return ok(result.Attributes);
  } catch (err: any) {
    if (err.name === 'ConditionalCheckFailedException') {
      return notFound('Idea not found');
    }
    console.error('ideas-update error', err);
    return serverError('Failed to update idea');
  }
};
