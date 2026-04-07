import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import Anthropic from '@anthropic-ai/sdk';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { ok, badRequest, unauthorized, serverError } from '../lib/response.js';

const secretsManager = new SecretsManagerClient({ region: 'eu-central-1' });
const s3 = new S3Client({ region: 'eu-central-1' });
const DATA_BUCKET = process.env.DATA_BUCKET!;

let cachedApiKey: string | null = null;

async function getAnthropicApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;
  const result = await secretsManager.send(
    new GetSecretValueCommand({ SecretId: process.env.ANTHROPIC_SECRET_ARN! }),
  );
  cachedApiKey = result.SecretString!;
  return cachedApiKey;
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();

    let userId: string;
    try {
      const payload = await verifyTeamToken(token);
      userId = payload.sub;
    } catch {
      return unauthorized('Team access required');
    }

    const body = JSON.parse(event.body || '{}');
    const { category, prompt, count } = body;

    if (!category) return badRequest('category is required');

    const ideaCount = Math.min(Math.max(count ?? 3, 2), 6);

    const apiKey = await getAnthropicApiKey();
    const anthropic = new Anthropic({ apiKey });

    const systemPrompt = `You are an SAP and AWS innovation expert. You help teams brainstorm innovative ideas that leverage SAP technologies with AWS cloud services. You understand S/4HANA, BTP, SAP Fiori, ABAP, and AWS services like Lambda, DynamoDB, Bedrock, SageMaker, IoT, and more. Generate practical, impactful innovation ideas that can be implemented.`;

    const userPrompt = prompt
      ? `Category: ${category}\n\nAdditional context: ${prompt}\n\nGenerate ${ideaCount} innovative SAP+AWS ideas as a JSON array.`
      : `Category: ${category}\n\nGenerate ${ideaCount} innovative SAP+AWS ideas as a JSON array.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `${userPrompt}\n\nRespond with ONLY a JSON array where each object has: title (string), description (string), category (string), effort (low|medium|high), impact (low|medium|high), tags (string array). No markdown, no explanation, just the JSON array.`,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    const ideas = JSON.parse(textContent?.text || '[]');

    // Save session to S3
    const sessionId = `${Date.now()}-${userId}`;
    const sessionData = {
      sessionId,
      userId,
      category,
      prompt: prompt || null,
      count: ideaCount,
      ideas,
      createdAt: new Date().toISOString(),
    };

    await s3.send(
      new PutObjectCommand({
        Bucket: DATA_BUCKET,
        Key: `brainstorm/${sessionId}.json`,
        Body: JSON.stringify(sessionData, null, 2),
        ContentType: 'application/json',
      }),
    );

    return ok({ sessionId, ideas });
  } catch (err) {
    console.error('brainstorm-generate error', err);
    return serverError('Failed to generate ideas');
  }
};
