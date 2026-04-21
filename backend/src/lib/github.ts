/**
 * GitHub REST API helpers — plain fetch, no Octokit dependency.
 * Uses auto_init repo + Git Data API fast-forward commit:
 *   1. POST /user/repos (auto_init: true)       — create repo with initial commit
 *   2. GET  /repos/{o}/{r}/git/ref/heads/main   — get parent SHA
 *   3. POST /repos/{o}/{r}/git/blobs            — one per file (parallel)
 *   4. POST /repos/{o}/{r}/git/trees            — tree w/ base_tree = parent
 *   5. POST /repos/{o}/{r}/git/commits          — commit w/ parent
 *   6. PATCH /repos/{o}/{r}/git/refs/heads/main — fast-forward update
 */

export interface GithubPushFile {
  path: string;
  content: string;
}

export interface GithubPushResult {
  ownerLogin: string;
  repoName: string;
  htmlUrl: string;
  cloneUrl: string;
  sshUrl: string;
  defaultBranch: string;
}

interface GithubError {
  message: string;
  status?: number;
}

const API = 'https://api.github.com';

async function ghFetch<T>(
  token: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url.startsWith('http') ? url : API + url, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'APX-Innovation-Platform',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    const parsed: GithubError = { message: text, status: res.status };
    try {
      const j = JSON.parse(text);
      if (j.message) parsed.message = j.message;
    } catch {
      // text was not JSON — keep raw text as message
    }
    const err = new Error(`GitHub API ${res.status}: ${parsed.message}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export async function getAuthenticatedUser(token: string): Promise<{ login: string }> {
  return ghFetch(token, '/user');
}

export async function createRepoAndPush(
  token: string,
  repoName: string,
  files: GithubPushFile[],
  opts: { private?: boolean; organization?: string; description?: string } = {},
): Promise<GithubPushResult> {
  // Step 1: Create repo with auto_init so it has an initial commit + main branch.
  // This avoids "Git Repository is empty" when using Git Data API on a new repo.
  const createUrl = opts.organization
    ? `/orgs/${opts.organization}/repos`
    : '/user/repos';
  const repo = await ghFetch<{
    owner: { login: string };
    name: string;
    html_url: string;
    clone_url: string;
    ssh_url: string;
    default_branch: string;
  }>(token, createUrl, {
    method: 'POST',
    body: JSON.stringify({
      name: repoName,
      description: opts.description || 'Scaffolded by APX Innovation Platform',
      private: opts.private ?? true,
      auto_init: true,
    }),
  });
  const owner = repo.owner.login;
  const name = repo.name;
  const branch = repo.default_branch || 'main';

  // GitHub needs a moment after auto_init to materialize the initial ref.
  await new Promise((r) => setTimeout(r, 1500));

  // Step 2: Get current HEAD commit on the default branch.
  const ref = await ghFetch<{ object: { sha: string } }>(
    token,
    `/repos/${owner}/${name}/git/ref/heads/${branch}`,
  );
  const parentSha = ref.object.sha;

  // Step 3: Create blobs (one per file) — parallel to save time.
  const blobShas: Array<{ path: string; sha: string }> = await Promise.all(
    files.map(async (f) => {
      const blob = await ghFetch<{ sha: string }>(
        token,
        `/repos/${owner}/${name}/git/blobs`,
        {
          method: 'POST',
          body: JSON.stringify({
            content: Buffer.from(f.content, 'utf8').toString('base64'),
            encoding: 'base64',
          }),
        },
      );
      return { path: f.path, sha: blob.sha };
    }),
  );

  // Step 4: Create tree with base_tree = parent so README.md from auto_init
  // stays (unless our files overwrite it, e.g. we do include a README.md).
  const tree = await ghFetch<{ sha: string }>(token, `/repos/${owner}/${name}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: parentSha,
      tree: blobShas.map((b) => ({
        path: b.path,
        mode: '100644',
        type: 'blob',
        sha: b.sha,
      })),
    }),
  });

  // Step 5: Create commit with parent = current HEAD.
  const commit = await ghFetch<{ sha: string }>(token, `/repos/${owner}/${name}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'Initial scaffold from APX Innovation Platform',
      tree: tree.sha,
      parents: [parentSha],
    }),
  });

  // Step 6: Fast-forward the branch to the new commit.
  await ghFetch(token, `/repos/${owner}/${name}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({
      sha: commit.sha,
      force: false,
    }),
  });

  return {
    ownerLogin: owner,
    repoName: name,
    htmlUrl: repo.html_url,
    cloneUrl: repo.clone_url,
    sshUrl: repo.ssh_url,
    defaultBranch: branch,
  };
}

export function kebabCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}
