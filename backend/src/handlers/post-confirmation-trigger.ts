import type { PostConfirmationTriggerEvent, PostConfirmationTriggerHandler } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';

export const handler: PostConfirmationTriggerHandler = async (event: PostConfirmationTriggerEvent) => {
  try {
    console.log('Post-confirmation trigger', JSON.stringify({ triggerSource: event.triggerSource, userName: event.userName }));

    const { userName, request } = event;
    const attributes = request.userAttributes;

    const now = new Date().toISOString();

    const userRecord = {
      PK: `USER#${userName}`,
      SK: 'PROFILE',
      userId: userName,
      email: attributes.email || '',
      company: attributes['custom:company'] || '',
      role: 'customer',
      hasVoted: false,
      cognitoSub: attributes.sub,
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: userRecord,
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );

    console.log(`User profile created for ${userName}`);

    return event;
  } catch (err) {
    console.error('post-confirmation-trigger error', err);
    // Don't throw — allow confirmation to proceed even if DDB write fails
    return event;
  }
};
