import type { ScheduledEvent } from 'aws-lambda';
import { ScanCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';

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

    // Count votes per idea
    const voteCounts: Record<string, number> = {};
    const uniqueVoters = new Set<string>();

    for (const vote of votes) {
      const ideaId = vote.ideaId as string;
      const userId = vote.userId as string;
      voteCounts[ideaId] = (voteCounts[ideaId] || 0) + 1;
      uniqueVoters.add(userId);
    }

    // Fetch idea metadata for enrichment
    const ideaEntries = await Promise.all(
      Object.keys(voteCounts).map(async (ideaId) => {
        const ideaResult = await ddb.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `IDEA#${ideaId}`, SK: 'METADATA' },
          }),
        );
        return {
          ideaId,
          title: ideaResult.Item?.name || 'Unknown',
          category: ideaResult.Item?.category || 'Unknown',
          voteCount: voteCounts[ideaId],
        };
      }),
    );

    // Sort by vote count descending
    ideaEntries.sort((a, b) => b.voteCount - a.voteCount);

    const now = new Date().toISOString();

    // Update RESULTS#CURRENT METADATA record
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: 'RESULTS#CURRENT',
          SK: 'METADATA',
          ideas: ideaEntries,
          totalVotes: votes.length,
          uniqueVoters: uniqueVoters.size,
          updatedAt: now,
        },
      }),
    );

    console.log(`Aggregation complete: ${votes.length} votes, ${uniqueVoters.size} voters, ${ideaEntries.length} ideas`);

    return { statusCode: 200, body: 'Aggregation complete' };
  } catch (err) {
    console.error('results-aggregator error', err);
    throw err;
  }
};
