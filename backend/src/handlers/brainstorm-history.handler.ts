import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ListObjectsV2Command, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { ok, unauthorized, serverError } from '../lib/response.js';

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

    const listResult = await s3.send(
      new ListObjectsV2Command({
        Bucket: DATA_BUCKET,
        Prefix: 'brainstorm/',
      }),
    );

    const sessions = [];

    if (listResult.Contents) {
      // Sort by last modified descending
      const sorted = listResult.Contents.sort(
        (a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0),
      );

      // Fetch metadata for each session (limit to 50 most recent)
      for (const obj of sorted.slice(0, 50)) {
        try {
          const getResult = await s3.send(
            new GetObjectCommand({
              Bucket: DATA_BUCKET,
              Key: obj.Key,
            }),
          );
          const body = await getResult.Body?.transformToString();
          if (body) {
            const session = JSON.parse(body);
            sessions.push({
              sessionId: session.sessionId,
              category: session.category,
              prompt: session.prompt,
              ideaCount: session.ideas?.length ?? 0,
              createdAt: session.createdAt,
            });
          }
        } catch {
          // Skip malformed entries
        }
      }
    }

    return ok(sessions);
  } catch (err) {
    console.error('brainstorm-history error', err);
    return serverError('Failed to get brainstorm history');
  }
};
