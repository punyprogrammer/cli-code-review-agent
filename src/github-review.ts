import { type Finding } from "./analyze";
import { type CombinedReview } from "./reporter";

type PullRequestContext = {
  token: string;
  repository: string;
  pullNumber: string;
  commitId: string;
  changedPaths: Set<string>;
};

type ReviewComment = {
  path: string;
  subject_type: "file";
  body: string;
};

function redact(text: string): string {
  const secrets = [
    process.env.GH_TOKEN,
    process.env.REVIEW_GITHUB_TOKEN,
    process.env.GITHUB_TOKEN,
  ].filter((value): value is string => Boolean(value));
  return secrets.reduce(
    (message, secret) => message.split(secret).join("[redacted]"),
    text,
  );
}

function normalizePath(file: string): string {
  return file.trim().replace(/^`+|`+$/g, "").replace(/^\.\//, "").replace(/^repo\//, "");
}

function pullRequestContext(): PullRequestContext | undefined {
  const token =
    process.env.GH_TOKEN?.trim() ||
    process.env.REVIEW_GITHUB_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim();
  const repository = process.env.CALLER_REPO?.trim();
  const pullNumber = process.env.PR_NUMBER?.trim();
  const commitId = process.env.REVIEW_REVISION?.trim();
  if (!token || !repository || !pullNumber || !commitId) return undefined;
  const changedPaths = new Set(
    (process.env.REVIEW_PATHS ?? "")
      .split("\n")
      .map(normalizePath)
      .filter(Boolean),
  );
  return { token, repository, pullNumber, commitId, changedPaths };
}

function findingBody(finding: Finding): string {
  return `[${finding.severity.toUpperCase()}] ${finding.category}\n${finding.summary}\n\n${finding.recommendation}`;
}

function reviewBody(
  review: CombinedReview,
  extraFindings: Finding[],
  extraHeading: string,
): string {
  const lines = [`Overall risk: ${review.overallRisk.toUpperCase()}`];
  if (review.testFindings.length > 0) {
    lines.push("", "Test findings:");
    for (const finding of review.testFindings) {
      lines.push(`- [${finding.severity.toUpperCase()}] ${finding.details}`);
    }
  }
  if (extraFindings.length > 0) {
    lines.push("", extraHeading);
    for (const finding of extraFindings) {
      lines.push(
        `- [${finding.severity.toUpperCase()}] ${finding.file}: ${finding.summary}`,
      );
    }
  }
  return lines.join("\n");
}

function fileComments(review: CombinedReview, changedPaths: Set<string>): {
  comments: ReviewComment[];
  unmatched: Finding[];
} {
  const grouped = new Map<string, Finding[]>();
  const unmatched: Finding[] = [];
  for (const finding of review.aiFindings) {
    const path = normalizePath(finding.file);
    if (!changedPaths.has(path)) {
      unmatched.push(finding);
      continue;
    }
    const existing = grouped.get(path) ?? [];
    existing.push(finding);
    grouped.set(path, existing);
  }
  const comments = [...grouped.entries()].map(([path, findings]) => ({
    path,
    subject_type: "file" as const,
    body: findings.map(findingBody).join("\n\n"),
  }));
  return { comments, unmatched };
}

async function githubPost(
  context: PullRequestContext,
  path: string,
  payload: unknown,
): Promise<{ ok: true; json: { id?: number } } | { ok: false; status: number; message: string }> {
  const response = await fetch(`https://api.github.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(payload),
  });
  const message = redact(await response.text());
  if (!response.ok) return { ok: false, status: response.status, message };
  return { ok: true, json: message ? (JSON.parse(message) as { id?: number }) : {} };
}

export async function publishPullRequestReview(
  review: CombinedReview,
): Promise<void> {
  const context = pullRequestContext();
  if (!context) return;

  const { comments, unmatched } = fileComments(review, context.changedPaths);
  const posted = await githubPost(
    context,
    `/repos/${context.repository}/pulls/${context.pullNumber}/reviews`,
    {
      commit_id: context.commitId,
      event: "COMMENT",
      body: reviewBody(review, unmatched, "Findings outside the pull request diff:"),
    },
  );
  if (!posted.ok) {
    throw new Error(
      `Failed to publish pull request review: ${posted.status} ${posted.message}`,
    );
  }

  const diffLines = await changedFileLines(context);
  let publishedComments = 0;
  for (const comment of comments) {
    const fileComment = await postFileComment(context, comment, diffLines);
    if (!fileComment.ok) {
      console.error(
        `Failed to comment on ${comment.path}: ${fileComment.status} ${fileComment.message}`,
      );
      continue;
    }
    publishedComments += 1;
  }
  if (comments.length > 0 && publishedComments === 0) {
    throw new Error("Failed to publish file comments on the pull request.");
  }
  console.log(
    `Published a pull request review on ${context.repository}#${context.pullNumber} with ${publishedComments} file comment(s).`,
  );
}

async function postFileComment(
  context: PullRequestContext,
  comment: ReviewComment,
  diffLines: Map<string, number>,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const path = `/repos/${context.repository}/pulls/${context.pullNumber}/comments`;
  const onFile = await githubPost(context, path, {
    commit_id: context.commitId,
    path: comment.path,
    subject_type: "file",
    body: comment.body,
  });
  if (onFile.ok) return { ok: true };
  const line = diffLines.get(comment.path);
  if (!line) return onFile;
  return githubPost(context, path, {
    commit_id: context.commitId,
    path: comment.path,
    line,
    side: "RIGHT",
    body: comment.body,
  });
}

async function changedFileLines(
  context: PullRequestContext,
): Promise<Map<string, number>> {
  const lines = new Map<string, number>();
  const response = await fetch(
    `https://api.github.com/repos/${context.repository}/pulls/${context.pullNumber}/files?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${context.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) return lines;
  const files = (await response.json()) as Array<{
    filename?: string;
    patch?: string;
  }>;
  for (const file of files) {
    if (!file.filename || !file.patch) continue;
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)/m.exec(file.patch);
    if (!match) continue;
    const line = Number(match[1]);
    if (line > 0) lines.set(file.filename, line);
  }
  return lines;
}
