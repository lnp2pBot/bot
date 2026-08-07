// Syncs the repository to the version carried by a release tag.
//
// Run from the Release workflow when a `v*` tag is pushed. It bumps
// package.json and package-lock.json on the default branch and re-points the
// tag at the resulting commit, so pushing the tag is the only manual step.
//
// Commits go through the Contents API instead of `git push` because the
// default branch requires signed commits, and only API-created commits are
// signed by GitHub.

const API = 'https://api.github.com';

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const tag = process.env.TAG;
const branch = process.env.BRANCH || 'main';

if (!token || !repo || !tag) {
  throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY and TAG are required');
}

const version = tag.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Tag "${tag}" must look like vMAJOR.MINOR.PATCH`);
}

const api = async (path, init = {}) => {
  const res = await fetch(`${API}/repos/${repo}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(
      `${init.method || 'GET'} ${path} -> ${res.status} ${await res.text()}`
    );
  }
  return res.json();
};

const readJsonFile = async path => {
  const file = await api(`/contents/${path}?ref=${branch}`);
  const text = Buffer.from(file.content, 'base64').toString('utf8');
  return { sha: file.sha, data: JSON.parse(text) };
};

const commitJsonFile = async (path, sha, data, message) => {
  const content = Buffer.from(
    `${JSON.stringify(data, null, 2)}\n`,
    'utf8'
  ).toString('base64');
  const result = await api(`/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content, sha, branch }),
  });
  console.log(`${message} (${result.commit.sha})`);
  return result.commit.sha;
};

// A tag pointing at a commit that never reached the default branch would make
// the bump commit graft unrelated history onto the release, so refuse it.
const assertTagIsOnBranch = async () => {
  const { status } = await api(
    `/compare/${encodeURIComponent(branch)}...${encodeURIComponent(tag)}`
  );
  if (status !== 'identical' && status !== 'behind') {
    throw new Error(
      `Tag ${tag} is "${status}" relative to ${branch}; tag a commit that is already merged`
    );
  }
};

const bumpPackageJson = async () => {
  const { sha, data } = await readJsonFile('package.json');
  if (data.version === version) return null;
  return commitJsonFile(
    'package.json',
    sha,
    { ...data, version },
    `chore: bump package.json to ${tag}`
  );
};

const bumpPackageLock = async () => {
  const { sha, data } = await readJsonFile('package-lock.json');
  const root = data.packages?.[''];
  if (data.version === version && root?.version === version) return null;
  const next = {
    ...data,
    version,
    ...(root && {
      packages: { ...data.packages, '': { ...root, version } },
    }),
  };
  return commitJsonFile(
    'package-lock.json',
    sha,
    next,
    `chore: sync package-lock.json to ${tag}`
  );
};

const repointTag = async sha => {
  await api(`/git/refs/tags/${tag}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha, force: true }),
  });
  console.log(`Tag ${tag} now points at ${sha}`);
};

await assertTagIsOnBranch();

// Sequential on purpose: each Contents API commit must build on the previous
// one, and a concurrent PUT would fail on a stale blob sha.
const packageJsonCommit = await bumpPackageJson();
const packageLockCommit = await bumpPackageLock();
const lastCommit = packageLockCommit || packageJsonCommit;

if (lastCommit) {
  await repointTag(lastCommit);
} else {
  console.log(`Version files already at ${version}; tag left untouched`);
}
