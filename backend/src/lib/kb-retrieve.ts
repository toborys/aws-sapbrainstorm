import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'eu-central-1' });
const DATA_BUCKET = process.env.DATA_BUCKET!;

interface KbIdeaSummary {
  id: string;
  name: string;
  tagline: string;
  category: string;
  awsServices: string[];
  sapModules: string[];
  championedBy: string[];
  savedAt?: string;
}

/**
 * Retrieve existing ideas from the Knowledge Base for brainstorm context.
 *
 * Purpose: the Principal Architect needs to know what ideas already exist
 * in the portfolio so the panel does not re-propose duplicates, and can
 * build on / reference existing work.
 *
 * Strategy: list knowledge-base/ideas/*.json (most recent N by LastModified),
 * fetch them, return as compact summaries. If an idea lacks the .json file
 * (older data), we silently skip — KB is best-effort context.
 */
export async function getKnowledgeBaseContext(
  limit = 30,
): Promise<KbIdeaSummary[]> {
  try {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: DATA_BUCKET,
        Prefix: 'knowledge-base/ideas/',
        MaxKeys: 1000,
      }),
    );
    const jsonKeys = (listed.Contents || [])
      .filter((o) => o.Key && o.Key.endsWith('.json'))
      .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
      .slice(0, limit);

    const summaries: KbIdeaSummary[] = [];
    for (const obj of jsonKeys) {
      try {
        const got = await s3.send(
          new GetObjectCommand({ Bucket: DATA_BUCKET, Key: obj.Key! }),
        );
        const body = await got.Body?.transformToString();
        if (!body) continue;
        const idea = JSON.parse(body) as Record<string, unknown>;
        summaries.push({
          id: String(idea.id || ''),
          name: String(idea.name || 'Untitled'),
          tagline: String(idea.tagline || ''),
          category: String(idea.category || 'Uncategorized'),
          awsServices: Array.isArray(idea.awsServices) ? (idea.awsServices as string[]) : [],
          sapModules: Array.isArray(idea.sapModules) ? (idea.sapModules as string[]) : [],
          championedBy: Array.isArray(idea.championedBy) ? (idea.championedBy as string[]) : [],
          savedAt: typeof idea.savedToKnowledgeBaseAt === 'string' ? idea.savedToKnowledgeBaseAt : undefined,
        });
      } catch {
        // Skip unreadable entries
      }
    }
    return summaries;
  } catch (err) {
    console.error('KB context retrieval failed (non-fatal)', err);
    return [];
  }
}

/**
 * Format KB summaries as a compact text block for injection into the
 * Architect's system prompt. Token-efficient: one line per idea.
 */
export function formatKbContext(summaries: KbIdeaSummary[]): string {
  if (summaries.length === 0) return '';
  const lines = summaries.map((s, i) => {
    const sap = s.sapModules.length > 0 ? ` [SAP: ${s.sapModules.join(',')}]` : '';
    const aws = s.awsServices.length > 0 ? ` [AWS: ${s.awsServices.slice(0, 3).join(',')}${s.awsServices.length > 3 ? '...' : ''}]` : '';
    return `${i + 1}. "${s.name}" (${s.category}) — ${s.tagline}${sap}${aws}`;
  });
  return `\n\nEXISTING IDEAS IN PORTFOLIO (${summaries.length}) — DO NOT DUPLICATE:\n${lines.join('\n')}\n\nRULES:\n- Do NOT propose ideas that substantially overlap with the above.\n- You MAY reference them (e.g., "extends idea #3 with X") but each new proposal must add genuinely new value.\n- If the user's request overlaps heavily with an existing idea, propose complementary or adjacent ideas instead.\n`;
}

/**
 * Count helper for UI indicator.
 */
export async function getKnowledgeBaseCount(): Promise<number> {
  try {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: DATA_BUCKET,
        Prefix: 'knowledge-base/ideas/',
        MaxKeys: 1000,
      }),
    );
    return (listed.Contents || []).filter((o) => o.Key?.endsWith('.json')).length;
  } catch {
    return 0;
  }
}
