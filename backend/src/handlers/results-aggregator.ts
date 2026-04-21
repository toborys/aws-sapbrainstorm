import type { ScheduledEvent } from 'aws-lambda';
import { ScanCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';

// WP-21: weighting tables
const WTP_MULTIPLIER: Record<string, number> = {
  'wont-pay': 0,
  'lt-100': 0.5,
  '100-300': 1.0,
  '300-800': 2.0,
  '800-2000': 4.0,
  'gt-2000': 8.0,
};

const WTP_MIDPOINT: Record<string, number> = {
  'wont-pay': 0,
  'lt-100': 50,
  '100-300': 200,
  '300-800': 550,
  '800-2000': 1400,
  'gt-2000': 3000,
};

const URGENCY_MULTIPLIER: Record<string, number> = {
  '0-3m': 1.5,
  '3-12m': 1.0,
  '12m-plus': 0.7,
  'not-sure': 1.0,
};

const PILOT_BONUS = 2.0;

type UrgencyBreakdown = {
  '0-3m': number;
  '3-12m': number;
  '12m-plus': number;
  'not-sure': number;
};

function emptyUrgencyBreakdown(): UrgencyBreakdown {
  return { '0-3m': 0, '3-12m': 0, '12m-plus': 0, 'not-sure': 0 };
}

export const handler = async (_event: ScheduledEvent) => {
  try {
    console.log('Starting results aggregation');

    // Scan all VOTE# records (individual votes per idea)
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

    const votes = votesResult.Items || [];

    // Count raw votes per idea + unique voters (existing behavior)
    const voteCounts: Record<string, number> = {};
    const uniqueVoters = new Set<string>();

    for (const vote of votes) {
      const ideaId = vote.ideaId as string;
      const userId = vote.userId as string;
      voteCounts[ideaId] = (voteCounts[ideaId] || 0) + 1;
      uniqueVoters.add(userId);
    }

    // --- WP-21: scan SESSION# records for weighted score inputs ---
    const sessionsResult = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': 'VOTE#',
          ':sk': 'SESSION#',
        },
      }),
    );

    const sessions = sessionsResult.Items || [];

    // Per-idea aggregates
    const weightedScoreByIdea: Record<string, number> = {};
    const wtpSumByIdea: Record<string, number> = {};
    const wtpCountByIdea: Record<string, number> = {};
    const pilotInterestByIdea: Record<string, number> = {};
    const urgencyByIdea: Record<string, UrgencyBreakdown> = {};

    const pilotList: Array<{
      ideaId: string;
      ideaName: string;
      email: string;
      rank: number;
      wtpBand: string;
    }> = [];

    for (const session of sessions) {
      const ideaIds: string[] = Array.isArray(session.ideaIds) ? (session.ideaIds as string[]) : [];
      if (ideaIds.length === 0) continue;

      // ranking defaults to ideaIds order if missing (backward compat)
      const rankingRaw = Array.isArray(session.ranking)
        ? (session.ranking as string[])
        : ideaIds;
      // Filter ranking to actual ideaIds to be safe
      const ranking = rankingRaw.filter((r) => typeof r === 'string');

      const wtpBand = typeof session.wtpBand === 'string' ? (session.wtpBand as string) : null;
      const urgency = typeof session.urgency === 'string' ? (session.urgency as string) : null;
      const pilotOptIn = session.pilotOptIn === true;
      const pilotEmail = typeof session.pilotEmail === 'string' ? (session.pilotEmail as string) : null;

      const wtpMult = wtpBand && wtpBand in WTP_MULTIPLIER ? WTP_MULTIPLIER[wtpBand] : 1.0;
      const urgencyMult = urgency && urgency in URGENCY_MULTIPLIER ? URGENCY_MULTIPLIER[urgency] : 1.0;
      const wtpMidpoint = wtpBand && wtpBand in WTP_MIDPOINT ? WTP_MIDPOINT[wtpBand] : null;

      const rankingLen = ranking.length || 1;

      for (const ideaId of ideaIds) {
        // Find this idea's position in the ranking
        const position = ranking.indexOf(ideaId);
        const effectivePosition = position >= 0 ? position : ranking.length; // bottom if not ranked
        const rankWeight = (rankingLen - effectivePosition) / rankingLen;

        const inTop3 = position >= 0 && position < 3;
        const pilotBonus = pilotOptIn && inTop3 ? PILOT_BONUS : 0;

        const score = rankWeight * wtpMult * urgencyMult + pilotBonus;

        weightedScoreByIdea[ideaId] = (weightedScoreByIdea[ideaId] || 0) + score;

        // WTP midpoint avg (all voters who voted for idea AND provided a wtpBand)
        if (wtpMidpoint !== null) {
          wtpSumByIdea[ideaId] = (wtpSumByIdea[ideaId] || 0) + wtpMidpoint;
          wtpCountByIdea[ideaId] = (wtpCountByIdea[ideaId] || 0) + 1;
        }

        // Pilot interest count: ideaId in top 3 AND pilotOptIn
        if (pilotOptIn && inTop3) {
          pilotInterestByIdea[ideaId] = (pilotInterestByIdea[ideaId] || 0) + 1;
        }

        // Urgency breakdown
        if (!urgencyByIdea[ideaId]) urgencyByIdea[ideaId] = emptyUrgencyBreakdown();
        if (urgency && urgency in urgencyByIdea[ideaId]) {
          urgencyByIdea[ideaId][urgency as keyof UrgencyBreakdown] += 1;
        }
      }

      // Populate pilotList: one entry per (idea in top 3) for pilot opt-ins
      if (pilotOptIn && pilotEmail) {
        const top3 = ranking.slice(0, 3);
        top3.forEach((ideaId, idx) => {
          pilotList.push({
            ideaId,
            ideaName: '', // filled below after we fetch titles
            email: pilotEmail,
            rank: idx + 1,
            wtpBand: wtpBand ?? '',
          });
        });
      }
    }

    // Fetch idea metadata for enrichment (all ideas that appear in votes OR sessions)
    const allIdeaIds = new Set<string>([
      ...Object.keys(voteCounts),
      ...Object.keys(weightedScoreByIdea),
    ]);

    const ideaMetaById: Record<string, { name: string; category: string }> = {};
    await Promise.all(
      Array.from(allIdeaIds).map(async (ideaId) => {
        const ideaResult = await ddb.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `IDEA#${ideaId}`, SK: 'METADATA' },
          }),
        );
        ideaMetaById[ideaId] = {
          name: (ideaResult.Item?.name as string) || 'Unknown',
          category: (ideaResult.Item?.category as string) || 'Unknown',
        };
      }),
    );

    // Build ideas array with full metrics
    const ideaEntries = Array.from(allIdeaIds).map((ideaId) => {
      const meta = ideaMetaById[ideaId] || { name: 'Unknown', category: 'Unknown' };
      const wtpCount = wtpCountByIdea[ideaId] || 0;
      const averageWtp = wtpCount > 0 ? (wtpSumByIdea[ideaId] || 0) / wtpCount : 0;
      return {
        ideaId,
        title: meta.name,
        category: meta.category,
        voteCount: voteCounts[ideaId] || 0,
        weightedScore: Number((weightedScoreByIdea[ideaId] || 0).toFixed(4)),
        averageWtp: Math.round(averageWtp),
        pilotInterest: pilotInterestByIdea[ideaId] || 0,
        urgencyBreakdown: urgencyByIdea[ideaId] || emptyUrgencyBreakdown(),
      };
    });

    // Fill pilotList ideaName from metadata
    for (const p of pilotList) {
      p.ideaName = ideaMetaById[p.ideaId]?.name || 'Unknown';
    }

    // Sort by weightedScore descending (raw votes as tiebreaker)
    ideaEntries.sort((a, b) => {
      if (b.weightedScore !== a.weightedScore) return b.weightedScore - a.weightedScore;
      return b.voteCount - a.voteCount;
    });

    // Keep votesByIdea for backward compat
    const votesByIdea: Record<string, number> = { ...voteCounts };

    const now = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: 'RESULTS#CURRENT',
          SK: 'METADATA',
          ideas: ideaEntries,
          totalVotes: votes.length,
          uniqueVoters: uniqueVoters.size,
          pilotList,
          votesByIdea, // backward compat
          updatedAt: now,
        },
      }),
    );

    console.log(
      `Aggregation complete: ${votes.length} votes, ${uniqueVoters.size} voters, ` +
        `${ideaEntries.length} ideas, ${sessions.length} sessions, ${pilotList.length} pilot entries`,
    );

    return { statusCode: 200, body: 'Aggregation complete' };
  } catch (err) {
    console.error('results-aggregator error', err);
    throw err;
  }
};
