import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
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

    // Fetch all ideas
    const ideasResult = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'IDEA#',
          ':sk': 'METADATA',
        },
      }),
    );

    // Fetch all votes
    const votesResult = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': 'VOTE#',
          ':sk': 'IDEA#',
        },
      }),
    );

    const ideas = ideasResult.Items || [];
    const votes = votesResult.Items || [];

    // Build vote counts per idea
    const voteCounts: Record<string, number> = {};
    for (const vote of votes) {
      const ideaId = vote.ideaId as string;
      voteCounts[ideaId] = (voteCounts[ideaId] || 0) + 1;
    }

    // Generate CSV
    const csvHeader = 'IdeaId,Title,Category,Status,Effort,Impact,VoteCount,CreatedAt\n';
    const csvRows = ideas.map((idea) => {
      const fields = [
        idea.id,
        `"${(idea.title as string || '').replace(/"/g, '""')}"`,
        idea.category,
        idea.status,
        idea.effort || '',
        idea.impact || '',
        voteCounts[idea.id as string] || 0,
        idea.createdAt,
      ];
      return fields.join(',');
    });
    const csv = csvHeader + csvRows.join('\n');

    // Upload to S3
    const exportKey = `exports/export-${Date.now()}.csv`;
    await s3.send(
      new PutObjectCommand({
        Bucket: DATA_BUCKET,
        Key: exportKey,
        Body: csv,
        ContentType: 'text/csv',
      }),
    );

    // Generate presigned URL
    const presignedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: DATA_BUCKET,
        Key: exportKey,
      }),
      { expiresIn: 3600 },
    );

    return ok({ url: presignedUrl, key: exportKey });
  } catch (err) {
    console.error('admin-export error', err);
    return serverError('Failed to export data');
  }
};
