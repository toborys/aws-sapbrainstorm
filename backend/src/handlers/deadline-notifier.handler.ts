import type { ScheduledEvent } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';

const ses = new SESv2Client({ region: 'eu-central-1' });
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@example.com';

export const handler = async (_event: ScheduledEvent) => {
  try {
    console.log('Starting deadline notification check');

    // Scan USER# PROFILE records where hasVoted = false
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk AND hasVoted = :hasVoted',
        ExpressionAttributeValues: {
          ':pk': 'USER#',
          ':sk': 'PROFILE',
          ':hasVoted': false,
        },
      }),
    );

    const users = result.Items || [];
    const now = new Date();
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;
    let notificationsSent = 0;

    for (const user of users) {
      if (!user.votingDeadline || !user.email) continue;

      const deadline = new Date(user.votingDeadline as string);
      const timeUntilDeadline = deadline.getTime() - now.getTime();

      // Send reminder if within 48 hours and deadline hasn't passed
      if (timeUntilDeadline > 0 && timeUntilDeadline <= fortyEightHoursMs) {
        try {
          await ses.send(
            new SendEmailCommand({
              FromEmailAddress: FROM_EMAIL,
              Destination: {
                ToAddresses: [user.email as string],
              },
              Content: {
                Simple: {
                  Subject: {
                    Data: 'Reminder: Voting deadline approaching',
                    Charset: 'UTF-8',
                  },
                  Body: {
                    Text: {
                      Data: `Hello,\n\nThis is a friendly reminder that your voting deadline is approaching on ${deadline.toISOString()}.\n\nPlease submit your votes before the deadline.\n\nThank you,\nSAP Innovation Platform Team`,
                      Charset: 'UTF-8',
                    },
                    Html: {
                      Data: `<p>Hello,</p><p>This is a friendly reminder that your voting deadline is approaching on <strong>${deadline.toISOString()}</strong>.</p><p>Please submit your votes before the deadline.</p><p>Thank you,<br>SAP Innovation Platform Team</p>`,
                      Charset: 'UTF-8',
                    },
                  },
                },
              },
            }),
          );
          notificationsSent++;
          console.log(`Reminder sent to ${user.email}`);
        } catch (emailErr) {
          console.error(`Failed to send reminder to ${user.email}`, emailErr);
        }
      }
    }

    console.log(`Deadline check complete: ${notificationsSent} reminders sent out of ${users.length} pending users`);

    return { statusCode: 200, body: `${notificationsSent} reminders sent` };
  } catch (err) {
    console.error('deadline-notifier error', err);
    throw err;
  }
};
