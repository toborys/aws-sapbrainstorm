import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { ok, badRequest, unauthorized, serverError } from '../lib/response.js';

const lambdaClient = new LambdaClient({ region: 'eu-central-1' });
const s3 = new S3Client({ region: 'eu-central-1' });
const DATA_BUCKET = process.env.DATA_BUCKET!;

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
    const { category, prompt, count, agents, categoryGroup } = body;

    const ideaCount = Math.min(Math.max(count ?? 5, 1), 10);
    const sessionId = `${Date.now()}-${userId}`;

    // Save initial session status to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: DATA_BUCKET,
        Key: `brainstorm/${sessionId}.json`,
        Body: JSON.stringify({
          sessionId,
          userId,
          status: 'generating',
          category: category || 'all',
          categoryGroup: categoryGroup || 'all',
          prompt: prompt || null,
          count: ideaCount,
          agents: agents || [],
          ideas: [],
          discussion: '',
          createdAt: new Date().toISOString(),
        }),
        ContentType: 'application/json',
      }),
    );

    // Invoke worker Lambda asynchronously
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: process.env.WORKER_FUNCTION_NAME!,
        InvocationType: 'Event', // async — fire and forget
        Payload: new TextEncoder().encode(
          JSON.stringify({
            sessionId,
            userId,
            category: category || 'all',
            categoryGroup: categoryGroup || 'all',
            prompt: prompt || null,
            count: ideaCount,
            agents: agents || [],
          }),
        ),
      }),
    );

    return ok({ sessionId, status: 'generating' });
  } catch (err) {
    console.error('brainstorm-generate error', err);
    return serverError('Failed to start brainstorm session');
  }
};
