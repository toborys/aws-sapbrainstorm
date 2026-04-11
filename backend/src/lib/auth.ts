import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const customerVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.CUSTOMER_POOL_ID!,
  tokenUse: 'id',
  clientId: process.env.CUSTOMER_CLIENT_ID!,
});

const teamVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.TEAM_POOL_ID!,
  tokenUse: 'id',
  clientId: process.env.TEAM_CLIENT_ID!,
});

export function extractToken(event: APIGatewayProxyEventV2): string | undefined {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader) return undefined;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return undefined;
  return token;
}

export async function verifyCustomerToken(token: string) {
  return customerVerifier.verify(token);
}

export async function verifyTeamToken(token: string) {
  return teamVerifier.verify(token);
}

export async function getUserId(event: APIGatewayProxyEventV2): Promise<string> {
  const token = extractToken(event);
  if (!token) throw new Error('No token provided');
  try {
    const payload = await verifyTeamToken(token);
    return payload.sub;
  } catch {
    const payload = await verifyCustomerToken(token);
    return payload.sub;
  }
}

export async function getUserGroups(event: APIGatewayProxyEventV2): Promise<string[]> {
  const token = extractToken(event);
  if (!token) throw new Error('No token provided');
  try {
    const payload = await verifyTeamToken(token);
    return (payload['cognito:groups'] as string[]) || [];
  } catch {
    const payload = await verifyCustomerToken(token);
    return (payload['cognito:groups'] as string[]) || [];
  }
}
