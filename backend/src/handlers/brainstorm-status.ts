import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { ok, notFound, unauthorized, serverError } from '../lib/response.js';

const s3 = new S3Client({ region: 'eu-central-1' });
const DATA_BUCKET = process.env.DATA_BUCKET!;

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();

    try {
      await verifyTeamToken(token);
    } catch {
      return unauthorized('Team access required');
    }

    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) return notFound('Session not found');

    const result = await s3.send(
      new GetObjectCommand({
        Bucket: DATA_BUCKET,
        Key: `brainstorm/${sessionId}.json`,
      }),
    );

    const body = await result.Body?.transformToString();
    if (!body) return notFound('Session not found');

    const session = JSON.parse(body);
    return ok(session);
  } catch (err: any) {
    if (err.name === 'NoSuchKey') return notFound('Session not found');
    console.error('brainstorm-status error', err);
    return serverError('Failed to get session status');
  }
};
