// Syncs the repository to the version carried by a release tag.
//
// Run from the Release workflow when a `v*` tag is pushed. It bumps
// package.json and package-lock.json on the default branch and re-points the
// tag at the resulting commit, so pushing the tag is the only manual step.
//
// Commits go through the Contents API instead of `git push` because the
// default branch requires signed commits, and only API-created commits are
// signed by GitHub. Known limits of that API, neither of them reached today:
// it commits one file at a time, which is why a release adds two commits, and
// it cannot read or write blobs above 1 MB. package-lock.json is at ~264 KB;
// when it approaches 1 MB this has to move to the Git Database API, which
// would also collapse the two commits into one.
//
// An annotated tag is recreated over the bump commit so `git tag -a` keeps its
// message. A *signature* cannot survive this: it covers the object the tag was
// made on, so moving the tag necessarily invalidates it. Release tags are
// therefore unsigned by design, and `git tag -s` is downgraded with a warning.

const API = 'https://api.github.com';

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const tag = process.env.TAG;
const branch = process.env.BRANCH || 'main';

if (!token || !repo || !tag) {
  throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY and TAG are required');
}

// MAJOR.MINOR.PATCH with the optional prerelease and build metadata that the
// `v*` workflow trigger also accepts, e.g. v1.2.3-rc.1 or v1.2.3+build.5.
const SEMVER =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const REQUEST_TIMEOUT_MS = 30_000;
const PACKAGE_JSON_MESSAGE = `chore: bump package.json to ${tag}`;
const PACKAGE_LOCK_MESSAGE = `chore: sync package-lock.json to ${tag}`;
const BUMP_MESSAGES = [PACKAGE_JSON_MESSAGE, PACKAGE_LOCK_MESSAGE];

const version = tag.replace(/^v/, '');
if (!SEMVER.test(version)) {
  throw new Error(
    `Tag "${tag}" must look like vMAJOR.MINOR.PATCH[-prerelease][+build]`
  );
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
    // Without this a stalled connection would hang the job until its own
    // timeout hours later.
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
  // Files above 1 MB come back with an empty body and encoding "none", which
  // would otherwise surface as an opaque JSON parse error.
  if (file.encoding !== 'base64') {
    throw new Error(
      `${path} came back with encoding "${file.encoding}"; it is too large for the Contents API`
    );
  }
  const text = Buffer.from(file.content, 'base64').toString('utf8');
  return { sha: file.sha, data: JSON.parse(text) };
};

// The blob sha only guards against a concurrent change to this same file, so
// also assert what the new commit was built on: anything else means the branch
// moved and the release would carry commits the tag never covered.
const commitJsonFile = async (path, sha, data, message, expectedParent) => {
  const content = Buffer.from(
    `${JSON.stringify(data, null, 2)}\n`,
    'utf8'
  ).toString('base64');
  const result = await api(`/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content, sha, branch }),
  });
  const parent = result.commit.parents?.[0]?.sha;
  if (parent !== expectedParent) {
    throw new Error(
      `Commit for ${path} was built on ${parent} instead of ${expectedParent}; ${branch} moved mid-release`
    );
  }
  console.log(`${message} (${result.commit.sha})`);
  return result.commit.sha;
};

// The bump commit is created on top of the branch head, and the tag is then
// moved onto it. Unless the tag already points at that same head, moving it
// would pull commits into the release that were never tagged, so require an
// exact match: "ahead" means the tag is not merged, "behind" means the branch
// moved on after tagging, and both need a human decision. Returns the head the
// bump commits must build on.
const resolveReleaseHead = async () => {
  const { status } = await api(
    `/compare/${encodeURIComponent(branch)}...${encodeURIComponent(tag)}`
  );
  if (status !== 'identical') {
    // A run that died between the bump commits and the re-point leaves exactly
    // this state, and "tag the current head" alone would not explain it.
    if (status === 'behind') {
      const { commits } = await api(
        `/compare/${encodeURIComponent(tag)}...${encodeURIComponent(branch)}`
      );
      const onlyOurBumps =
        commits.length > 0 &&
        commits.every(({ commit }) =>
          BUMP_MESSAGES.some(message => commit.message.startsWith(message))
        );
      if (onlyOurBumps) {
        throw new Error(
          `An earlier run already bumped the version files for ${tag} but did not finish. ` +
            `Move the tag onto them and re-run this workflow: ` +
            `git fetch origin && git tag -f ${tag} origin/${branch} && git push -f origin ${tag}`
        );
      }
    }
    throw new Error(
      `Tag ${tag} is "${status}" relative to ${branch}; tag the current ${branch} head`
    );
  }
  const { sha } = await api(`/commits/${encodeURIComponent(branch)}`);
  return sha;
};

const bumpPackageJson = async parent => {
  const { sha, data } = await readJsonFile('package.json');
  if (data.version === version) return null;
  return commitJsonFile(
    'package.json',
    sha,
    { ...data, version },
    PACKAGE_JSON_MESSAGE,
    parent
  );
};

const bumpPackageLock = async parent => {
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
    PACKAGE_LOCK_MESSAGE,
    parent
  );
};

// Read before anything moves the ref, since re-pointing orphans the object.
const readAnnotation = async () => {
  const { object } = await api(`/git/ref/tags/${tag}`);
  if (object.type !== 'tag') return null;
  const { message, verification } = await api(`/git/tags/${object.sha}`);
  return { message, signed: Boolean(verification?.signature) };
};

const repointTag = async (sha, annotation) => {
  let target = sha;
  if (annotation) {
    if (annotation.signed) {
      console.log(
        `::warning::${tag} was signed; the release tag cannot carry that signature over to the bump commit`
      );
    }
    const created = await api('/git/tags', {
      method: 'POST',
      body: JSON.stringify({
        tag,
        message: annotation.message,
        object: sha,
        type: 'commit',
      }),
    });
    target = created.sha;
  }
  await api(`/git/refs/tags/${tag}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: target, force: true }),
  });
  console.log(
    `Tag ${tag} now points at ${sha}${annotation ? ' (annotation preserved)' : ''}`
  );
};

const taggedHead = await resolveReleaseHead();
const annotation = await readAnnotation();

// Sequential on purpose: each Contents API commit must build on the previous
// one, so each call also becomes the expected parent of the next.
let head = taggedHead;
head = (await bumpPackageJson(head)) ?? head;
head = (await bumpPackageLock(head)) ?? head;

if (head === taggedHead) {
  console.log(`Version files already at ${version}; tag left untouched`);
} else {
  await repointTag(head, annotation);
}
