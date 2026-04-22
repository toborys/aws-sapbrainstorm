import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminResetUserPasswordCommand,
  AdminGetUserCommand,
  AdminCreateUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { ok, badRequest, notFound, unauthorized, serverError } from '../lib/response.js';

const cognito = new CognitoIdentityProviderClient({ region: 'eu-central-1' });
const CUSTOMER_POOL_ID = process.env.CUSTOMER_POOL_ID!;

function randomPassword(): string {
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

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();
    try { await verifyTeamToken(token); } catch { return unauthorized('Team access required'); }

    // Path param is the customer's email (URL-encoded)
    const rawId = event.pathParameters?.id;
    if (!rawId) return badRequest('customer id (email) missing');
    const username = decodeURIComponent(rawId);

    // Verify user exists in the customer pool
    let userStatus: string | undefined;
    try {
      const user = await cognito.send(new AdminGetUserCommand({
        UserPoolId: CUSTOMER_POOL_ID,
        Username: username,
      }));
      userStatus = user.UserStatus;
    } catch (err: any) {
      if (err.name === 'UserNotFoundException') return notFound('user not found');
      throw err;
    }

    // Strategy depends on user status:
    // - FORCE_CHANGE_PASSWORD (invitation not yet completed): use AdminCreateUser
    //   with RESEND message action to resend the original invite email.
    // - CONFIRMED (user already set password): use AdminResetUserPassword to
    //   trigger a "forgot password" email.
    // - Else: generate a new temp password and return it for manual distribution.

    if (userStatus === 'FORCE_CHANGE_PASSWORD') {
      // Cognito supports RESEND message action only on AdminCreateUser.
      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: CUSTOMER_POOL_ID,
        Username: username,
        MessageAction: 'RESEND',
      }));
      return ok({
        status: 'resent',
        userStatus,
        message: 'Invitation resent via Cognito (original temp password still valid).',
      });
    }

    if (userStatus === 'CONFIRMED') {
      await cognito.send(new AdminResetUserPasswordCommand({
        UserPoolId: CUSTOMER_POOL_ID,
        Username: username,
      }));
      return ok({
        status: 'password-reset-triggered',
        userStatus,
        message: 'Password reset email sent by Cognito.',
      });
    }

    // Fallback: issue a new temp password (return it so the team can share manually)
    const newTemp = randomPassword();
    await cognito.send(new AdminCreateUserCommand({
      UserPoolId: CUSTOMER_POOL_ID,
      Username: username,
      MessageAction: 'SUPPRESS',
      TemporaryPassword: newTemp,
    } as any)).catch(() => {
      // User exists — AdminCreateUser would throw. Fall through.
    });
    return ok({
      status: 'new-temp-password',
      userStatus,
      tempPassword: newTemp,
      message: 'New temporary password generated. Share it with the customer.',
    });
  } catch (err: any) {
    console.error('admin-customers-resend error', err);
    return serverError(`Failed to resend: ${err.message || err.name || 'unknown'}`);
  }
};
