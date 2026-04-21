import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../lib/dynamo.js';
import { extractToken, verifyTeamToken } from '../lib/auth.js';
import { ok, badRequest, notFound, unauthorized, serverError } from '../lib/response.js';
import { renderBuildKit, type Idea } from '../lib/build-kit-templates.js';
import { createRepoAndPush, kebabCase, getAuthenticatedUser } from '../lib/github.js';

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const token = extractToken(event);
    if (!token) return unauthorized();
    try {
      await verifyTeamToken(token);
    } catch {
      return unauthorized('Team access required');
    }

    const id = event.pathParameters?.id;
    if (!id) return notFound('idea id missing');

    const body = JSON.parse(event.body || '{}');
    const githubToken = body.githubToken;
    if (!githubToken || typeof githubToken !== 'string') {
      return badRequest('githubToken is required in request body');
    }

    // Fetch idea
    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `IDEA#${id}`, SK: 'METADATA' },
      }),
    );
    if (!result.Item) return notFound('idea not found');
    const idea = result.Item as Idea;

    // Verify token works before doing anything destructive
    let ownerLogin: string;
    try {
      const user = await getAuthenticatedUser(githubToken);
      ownerLogin = user.login;
    } catch (err) {
      return badRequest(`GitHub token invalid: ${(err as Error).message}`);
    }

    // Resolve repo name
    const repoName =
      typeof body.repoName === 'string' && body.repoName.trim()
        ? kebabCase(body.repoName)
        : kebabCase(idea.name || 'apx-scaffold');

    // Render build-kit files
    const files = renderBuildKit(idea, idea.sourceSessionId);

    // Create repo + push
    try {
      const res = await createRepoAndPush(githubToken, repoName, files, {
        private: body.private !== false, // default private
        organization: body.organization || undefined,
        description: `${idea.name || 'APX idea'} — ${idea.tagline || ''}`.slice(0, 350),
      });
      return ok({
        ideaId: id,
        repo: res,
        ownerLogin,
        fileCount: files.length,
        pushedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('GitHub push failed', err);
      return serverError(`GitHub push failed: ${(err as Error).message}`);
    }
  } catch (err) {
    console.error('ideas-push-to-github error', err);
    return serverError('Push to GitHub failed');
  }
};
