import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { ok, unauthorized, serverError } from '../lib/response.js';

const s3 = new S3Client({ region: 'eu-central-1' });
const DATA_BUCKET = process.env.DATA_BUCKET!;

interface KbIdea {
  id: string;
  name: string;
  category: string;
  createdAt?: string;
  savedToKnowledgeBaseAt?: string;
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();
    try { await verifyTeamToken(token); } catch { return unauthorized('Team access required'); }

    // List all KB ideas
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: DATA_BUCKET,
        Prefix: 'knowledge-base/ideas/',
        MaxKeys: 1000,
      }),
    );
    const jsonKeys = (listed.Contents || [])
      .filter((o) => o.Key && o.Key.endsWith('.json'))
      .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0));

    const customIdeasListed = await s3.send(
      new ListObjectsV2Command({
        Bucket: DATA_BUCKET,
        Prefix: 'knowledge-base/custom-ideas/',
        MaxKeys: 1000,
      }),
    );
    const customIdeasCount = (customIdeasListed.Contents || []).filter((o) => o.Key?.endsWith('.json')).length;

    // Fetch metadata for each idea (up to 100 — enough for stats)
    const limit = Math.min(jsonKeys.length, 100);
    const ideas: KbIdea[] = [];
    for (const obj of jsonKeys.slice(0, limit)) {
      try {
        const got = await s3.send(new GetObjectCommand({ Bucket: DATA_BUCKET, Key: obj.Key! }));
        const body = await got.Body?.transformToString();
        if (!body) continue;
        const idea = JSON.parse(body) as Record<string, unknown>;
        ideas.push({
          id: String(idea.id || ''),
          name: String(idea.name || 'Untitled'),
          category: String(idea.category || 'Uncategorized'),
          createdAt: typeof idea.createdAt === 'string' ? idea.createdAt : undefined,
          savedToKnowledgeBaseAt: typeof idea.savedToKnowledgeBaseAt === 'string' ? idea.savedToKnowledgeBaseAt : undefined,
        });
      } catch {
        // Skip
      }
    }

    // Breakdown by category
    const byCategory: Record<string, number> = {};
    for (const idea of ideas) {
      byCategory[idea.category] = (byCategory[idea.category] || 0) + 1;
    }
    const categoryBreakdown = Object.entries(byCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Additions in last 7 / 30 days
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    let last7d = 0;
    let last30d = 0;
    for (const idea of ideas) {
      const when = Date.parse(idea.savedToKnowledgeBaseAt || idea.createdAt || '');
      if (isNaN(when)) continue;
      const diff = now - when;
      if (diff <= 7 * dayMs) last7d++;
      if (diff <= 30 * dayMs) last30d++;
    }

    // Most recent 5
    const recent = ideas.slice(0, 5).map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      savedAt: i.savedToKnowledgeBaseAt || i.createdAt,
    }));

    return ok({
      totalIdeas: jsonKeys.length,
      scanned: ideas.length,
      customIdeasCount,
      categoryBreakdown,
      last7d,
      last30d,
      recent,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('knowledge-base-stats error', err);
    return serverError('Failed to compute KB stats');
  }
};
