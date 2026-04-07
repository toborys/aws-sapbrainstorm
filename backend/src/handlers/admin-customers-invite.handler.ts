import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { created, badRequest, unauthorized, serverError } from '../lib/response.js';

const cognito = new CognitoIdentityProviderClient({ region: 'eu-central-1' });
const CUSTOMER_POOL_ID = process.env.CUSTOMER_POOL_ID!;

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();

    try {
      await verifyTeamToken(token);
    } catch {
      return unauthorized('Team access required');
    }

    const body = JSON.parse(event.body || '{}');
    const { email, company, votingDeadline } = body;

    if (!email || !company) {
      return badRequest('email and company are required');
    }

    // Create user in Cognito Customer Pool
    const createResult = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: CUSTOMER_POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:company', Value: company },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      }),
    );

    const userId = createResult.User?.Username!;

    // Add to customers group
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: CUSTOMER_POOL_ID,
        Username: userId,
        GroupName: 'customers',
      }),
    );

    const now = new Date().toISOString();

    // Create USER# PROFILE record in DynamoDB
    const userRecord = {
      PK: `USER#${userId}`,
      SK: 'PROFILE',
      userId,
      email,
      company,
      role: 'customer',
      hasVoted: false,
      votingDeadline: votingDeadline || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: userRecord,
      }),
    );

    return created(userRecord);
  } catch (err: any) {
    if (err.name === 'UsernameExistsException') {
      return badRequest('A user with this email already exists');
    }
    console.error('admin-customers-invite error', err);
    return serverError('Failed to invite customer');
  }
};
