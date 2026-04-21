import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyCustomerToken } from '../lib/auth.js';
import { ok, badRequest, unauthorized, serverError } from '../lib/response.js';
import { mirrorCustomIdeaToKnowledgeBase } from '../lib/knowledge-base.js';

const WTP_BANDS = ['lt-100', '100-300', '300-800', '800-2000', 'gt-2000', 'wont-pay'] as const;
const URGENCY_BANDS = ['0-3m', '3-12m', '12m-plus', 'not-sure'] as const;

type WtpBand = typeof WTP_BANDS[number];
type UrgencyBand = typeof URGENCY_BANDS[number];

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();

    let userId: string;
    try {
      const payload = await verifyCustomerToken(token);
      userId = payload.sub;
    } catch {
      return unauthorized('Customer access required');
    }

    const body = JSON.parse(event.body || '{}');
    const { ideaIds, customIdea } = body;

    if (!Array.isArray(ideaIds) || ideaIds.length === 0) {
      return badRequest('ideaIds must be a non-empty array');
    }

    if (ideaIds.length > 5) {
      return badRequest('Maximum 5 ideas allowed');
    }

    // --- Validate WP-19 extended fields ---
    let ranking: string[] | undefined;
    if (body.ranking !== undefined && body.ranking !== null) {
      if (!Array.isArray(body.ranking) || !body.ranking.every((r: unknown) => typeof r === 'string')) {
        return badRequest('ranking must be an array of strings');
      }
      // ranking must be a subset of ideaIds
      const ideaSet = new Set(ideaIds);
      for (const r of body.ranking) {
        if (!ideaSet.has(r)) {
          return badRequest('ranking contains idea IDs not present in ideaIds');
        }
      }
      ranking = body.ranking as string[];
    }

    let wtpBand: WtpBand | null = null;
    if (body.wtpBand !== undefined && body.wtpBand !== null) {
      if (!WTP_BANDS.includes(body.wtpBand)) {
        return badRequest(`wtpBand must be one of: ${WTP_BANDS.join(', ')}`);
      }
      wtpBand = body.wtpBand as WtpBand;
    }

    let urgency: UrgencyBand | null = null;
    if (body.urgency !== undefined && body.urgency !== null) {
      if (!URGENCY_BANDS.includes(body.urgency)) {
        return badRequest(`urgency must be one of: ${URGENCY_BANDS.join(', ')}`);
      }
      urgency = body.urgency as UrgencyBand;
    }

    const pilotOptIn = body.pilotOptIn === true;
    let pilotEmail: string | null = null;
    if (pilotOptIn) {
      if (typeof body.pilotEmail !== 'string' || body.pilotEmail.trim().length === 0) {
        return badRequest('pilotEmail is required when pilotOptIn is true');
      }
      pilotEmail = body.pilotEmail.trim();
    }

    const now = new Date().toISOString();
    const transactItems: any[] = [];

    // Create/update VOTE records for each idea
    for (const ideaId of ideaIds) {
      transactItems.push({
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: `VOTE#${userId}`,
            SK: `IDEA#${ideaId}`,
            userId,
            ideaId,
            votedAt: now,
          },
        },
      });
    }

    // Create SESSION record (WP-19: persist new fields)
    transactItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: {
          PK: `VOTE#${userId}`,
          SK: `SESSION#${now}`,
          userId,
          ideaIds,
          customIdea: customIdea || undefined,
          // default ranking = order they were picked
          ranking: ranking ?? ideaIds,
          wtpBand,
          urgency,
          pilotOptIn,
          pilotEmail,
          submittedAt: now,
        },
      },
    });

    // Optionally create CUSTOM record
    if (customIdea && typeof customIdea === 'string' && customIdea.trim().length > 0) {
      transactItems.push({
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: `CUSTOM#${userId}`,
            SK: `IDEA#${now}`,
            GSI1PK: 'STATUS#pending',
            GSI1SK: `CUSTOM#${userId}#${now}`,
            userId,
            content: customIdea.trim(),
            status: 'pending',
            createdAt: now,
          },
        },
      });
    }

    await ddb.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      }),
    );

    // Mirror custom idea (if any) to Knowledge Base — non-fatal
    if (customIdea && typeof customIdea === 'string' && customIdea.trim().length > 0) {
      await mirrorCustomIdeaToKnowledgeBase(now, {
        userId,
        content: customIdea.trim(),
        votedFor: ideaIds,
        submittedAt: now,
      });
    }

    return ok({
      message: 'Votes submitted successfully',
      ideaIds,
      customIdea: customIdea || null,
      ranking: ranking ?? ideaIds,
      wtpBand,
      urgency,
      pilotOptIn,
      pilotEmail,
    });
  } catch (err) {
    console.error('votes-submit error', err);
    return serverError('Failed to submit votes');
  }
};
