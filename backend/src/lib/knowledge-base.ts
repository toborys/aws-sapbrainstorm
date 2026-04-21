import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'eu-central-1' });
const DATA_BUCKET = process.env.DATA_BUCKET!;

/**
 * Knowledge Base layout in S3:
 *   knowledge-base/ideas/{id}.json          - canonical JSON snapshot
 *   knowledge-base/ideas/{id}.md            - human-readable markdown
 *   knowledge-base/custom-ideas/{sessionId}.json  - customer-submitted ideas
 *   knowledge-base/sessions/{sessionId}.json - already written by brainstorm-worker (symlinked conceptually)
 *
 * Purpose: every idea that makes it into the portfolio is mirrored here as
 * durable, retrievable R&D material. Future uses:
 *  - RAG context for future brainstorm sessions
 *  - Export/backup
 *  - Cross-team knowledge sharing
 *  - Bedrock Knowledge Base ingestion
 */

type IdeaLike = Record<string, unknown> & {
  id: string;
  name: string;
  category: string;
};

export async function mirrorIdeaToKnowledgeBase(idea: IdeaLike): Promise<void> {
  const json = JSON.stringify(
    {
      ...idea,
      savedToKnowledgeBaseAt: new Date().toISOString(),
      kbVersion: 1,
    },
    null,
    2,
  );

  const md = renderIdeaMarkdown(idea);

  // Write both in parallel; swallow errors (non-fatal for idea creation)
  try {
    await Promise.all([
      s3.send(
        new PutObjectCommand({
          Bucket: DATA_BUCKET,
          Key: `knowledge-base/ideas/${idea.id}.json`,
          Body: json,
          ContentType: 'application/json',
          Metadata: {
            'idea-id': idea.id,
            'category': String(idea.category || 'unknown'),
          },
        }),
      ),
      s3.send(
        new PutObjectCommand({
          Bucket: DATA_BUCKET,
          Key: `knowledge-base/ideas/${idea.id}.md`,
          Body: md,
          ContentType: 'text/markdown; charset=utf-8',
        }),
      ),
    ]);
  } catch (err) {
    console.error('Knowledge Base mirror failed (non-fatal)', err);
  }
}

export async function mirrorCustomIdeaToKnowledgeBase(
  sessionId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: DATA_BUCKET,
        Key: `knowledge-base/custom-ideas/${sessionId}.json`,
        Body: JSON.stringify(
          {
            ...payload,
            savedToKnowledgeBaseAt: new Date().toISOString(),
            kbVersion: 1,
          },
          null,
          2,
        ),
        ContentType: 'application/json',
      }),
    );
  } catch (err) {
    console.error('Knowledge Base custom-idea mirror failed (non-fatal)', err);
  }
}

function renderIdeaMarkdown(idea: IdeaLike): string {
  const a = idea as Record<string, unknown>;
  const list = (v: unknown): string => {
    if (!Array.isArray(v) || v.length === 0) return '_none_';
    return (v as unknown[]).map((x) => `- ${String(x)}`).join('\n');
  };
  const str = (v: unknown, fallback = '—'): string =>
    v === undefined || v === null || v === '' ? fallback : String(v);

  const cost = (a.costEstimate as { devEur?: number; prodEur?: number; assumptions?: string } | undefined) || {};

  return `# ${str(a.name)}

> ${str(a.tagline)}
> **Category:** ${str(a.category)} · **Saved:** ${new Date().toISOString()}
> **Source session:** ${str(a.sourceSessionId, 'n/a')}

---

## Problem

${str(a.problem)}

## Solution

${str(a.solution)}

## Target Buyer

${str(a.targetBuyer)}

> "${str(a.customerPerspective)}"

## Differentiator

${str(a.differentiator)}

---

## Technical

### AWS Services
${list(a.awsServices)}

### SAP Modules
${list(a.sapModules)}

### Architecture

${str(a.architecture)}

### Architecture Diagram (Mermaid)

\`\`\`mermaid
${str(a.architectureDiagram, 'flowchart TD\n  User([User]) --> App[' + str(a.name) + ']')}
\`\`\`

---

## Economics

| Field | Value |
|---|---|
| Complexity | ${str(a.complexity)} |
| MVP time | ${str(a.mvpTime)} |
| Risk | ${str(a.risk)} |
| Risk note | ${str(a.riskNote)} |
| Estimated MRR | ${str(a.mrr)} |
| Pricing model | ${str(a.model)} |
| Self-service | ${a.selfService ? 'yes' : 'no'} |
| Potential | ${str(a.potential)} |
| Cost — dev EUR | ${str(cost.devEur)} |
| Cost — prod EUR | ${str(cost.prodEur)} |
| Cost assumptions | ${str(cost.assumptions)} |

---

## Advisory Panel

### Championed by
${list(a.championedBy)}

### Concerns raised by
${list(a.challengedBy)}

### Panel notes

${str(a.panelNotes)}

---

*Mirrored to Knowledge Base from APX Innovation Platform.*
`;
}
