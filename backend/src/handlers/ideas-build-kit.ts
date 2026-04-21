import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import AdmZip from 'adm-zip';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { ok, notFound, unauthorized, serverError } from '../lib/response.js';
import { renderBuildKit, type Idea } from '../lib/build-kit-templates.js';

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

    const id = event.pathParameters?.id;
    if (!id) return notFound('idea id missing');

    // Fetch idea
    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `IDEA#${id}`, SK: 'METADATA' },
      }),
    );
    if (!result.Item) return notFound('idea not found');
    const idea = result.Item as Idea;

    // Render templates
    const files = renderBuildKit(idea, idea.sourceSessionId);

    // Build zip in memory
    const zip = new AdmZip();
    for (const f of files) {
      zip.addFile(f.path, Buffer.from(f.content, 'utf8'));
    }
    const zipBuffer = zip.toBuffer();

    // Upload zip to S3
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipKey = `build-kits/${id}/${timestamp}.zip`;
    await s3.send(
      new PutObjectCommand({
        Bucket: DATA_BUCKET,
        Key: zipKey,
        Body: zipBuffer,
        ContentType: 'application/zip',
        ContentDisposition: `attachment; filename="${id}-build-kit.zip"`,
      }),
    );

    // Generate presigned URL (24h)
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: DATA_BUCKET, Key: zipKey }),
      { expiresIn: 86400 },
    );

    return ok({
      ideaId: id,
      generatedAt: new Date().toISOString(),
      files: files.map(f => f.path),
      presignedUrl: url,
      expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
    });
  } catch (err) {
    console.error('ideas-build-kit error', err);
    return serverError('Failed to build kit');
  }
};
