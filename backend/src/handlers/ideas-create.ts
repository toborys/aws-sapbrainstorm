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

    let userId: string;
    try {
      const payload = await verifyTeamToken(token);
      userId = payload.sub;
    } catch {
      return unauthorized('Team access required');
    }

    const body = JSON.parse(event.body || '{}');
    const { name, category } = body;

    if (!name || !category) {
      return badRequest('name and category are required');
    }

    const id = body.id || randomUUID();
    const now = new Date().toISOString();

    const item = {
      PK: `IDEA#${id}`,
      SK: 'METADATA',
      GSI1PK: `CATEGORY#${category}`,
      GSI1SK: `IDEA#${id}`,
      id,
      name,
      tagline: body.tagline || '',
      problem: body.problem || '',
      solution: body.solution || '',
      architecture: body.architecture || '',
      awsServices: body.awsServices || [],
      complexity: body.complexity || 'medium',
      mvpTime: body.mvpTime || '',
      risk: body.risk || 'medium',
      riskNote: body.riskNote || '',
      mrr: body.mrr || '',
      model: body.model || '',
      selfService: body.selfService ?? true,
      potential: body.potential || 'medium',
      category,
      categoryGroup: body.categoryGroup || 'technical',
      targetBuyer: body.targetBuyer || '',
      customerPerspective: body.customerPerspective || '',
      differentiator: body.differentiator || '',
      status: body.status || 'active',
      order: body.order ?? 0,
      createdAt: now,
      createdBy: userId,
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
