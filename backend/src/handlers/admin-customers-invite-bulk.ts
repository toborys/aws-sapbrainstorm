import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { ok, badRequest, unauthorized, serverError } from '../lib/response.js';

const cognito = new CognitoIdentityProviderClient({ region: 'eu-central-1' });
const CUSTOMER_POOL_ID = process.env.CUSTOMER_POOL_ID!;

interface InviteRow {
  email: string;
  company: string;
  votingDeadline?: string;
}

type InviteResult =
  | { ok: true; email: string; tempPassword: string }
  | { ok: false; email: string; error: string };

function randomPassword(): string {
  // 16 chars: guarantees at least one upper/lower/digit/symbol; remaining random mix.
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digit = '23456789';
  const symbol = '!@#$%&*';
  const all = upper + lower + digit + symbol;
  let pw =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digit[Math.floor(Math.random() * digit.length)] +
    symbol[Math.floor(Math.random() * symbol.length)];
  for (let i = 0; i < 12; i++) pw += all[Math.floor(Math.random() * all.length)];
  return pw;
}

async function inviteOne(row: InviteRow): Promise<InviteResult> {
  const rawEmail = (row?.email || '').toString();
  try {
    if (!rawEmail || !row.company) {
      return { ok: false, email: rawEmail || '(missing)', error: 'email and company required' };
    }
    const email = rawEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, email, error: 'invalid email format' };
    }
    const tempPassword = randomPassword();
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: CUSTOMER_POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:company', Value: row.company },
        ],
        TemporaryPassword: tempPassword,
        // SUPPRESS: we do not use Cognito's default email; the team copies temp passwords themselves.
        MessageAction: 'SUPPRESS',
      }),
    );
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: CUSTOMER_POOL_ID,
        Username: email,
        GroupName: 'customers',
      }),
    );
    const now = new Date().toISOString();
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${email}`,
          SK: 'PROFILE',
          userId: email,
          email,
          company: row.company,
          role: 'customer',
          hasVoted: false,
          votingDeadline: row.votingDeadline || undefined,
          invitedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
    return { ok: true, email, tempPassword };
  } catch (err: any) {
    const code = err?.name || err?.Code || err?.message || 'unknown error';
    const msg =
      code === 'UsernameExistsException'
        ? 'user already exists'
        : code === 'ConditionalCheckFailedException'
        ? 'profile already exists'
        : code;
    return { ok: false, email: rawEmail, error: msg };
  }
}

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
    const customers = body.customers;
    if (!Array.isArray(customers) || customers.length === 0) {
      return badRequest('customers must be a non-empty array');
    }
    if (customers.length > 100) {
      return badRequest('maximum 100 customers per batch');
    }

    // Process sequentially to avoid Cognito throttling (AdminCreateUser is TPS-limited).
    const results: InviteResult[] = [];
    for (const row of customers) {
      const result = await inviteOne(row as InviteRow);
      results.push(result);
    }

    const invited = results
      .filter((r): r is Extract<InviteResult, { ok: true }> => r.ok)
      .map((r) => ({ email: r.email, tempPassword: r.tempPassword }));
    const failed = results
      .filter((r): r is Extract<InviteResult, { ok: false }> => !r.ok)
      .map((r) => ({ email: r.email, error: r.error }));

    return ok({
      total: customers.length,
      invitedCount: invited.length,
      failedCount: failed.length,
      invited,
      failed,
    });
  } catch (err) {
    console.error('admin-customers-invite-bulk error', err);
    return serverError('Failed bulk invite');
  }
};
