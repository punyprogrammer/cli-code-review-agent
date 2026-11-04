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

async function createReview(
  context: PullRequestContext,
  body: string,
  comments: ReviewComment[],
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const response = await fetch(
    `https://api.github.com/repos/${context.repository}/pulls/${context.pullNumber}/reviews`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        commit_id: context.commitId,
        event: "COMMENT",
        body,
        comments,
      }),
    },
  );
  if (response.ok) return { ok: true };
  return {
    ok: false,
    status: response.status,
    message: redact(await response.text()),
  };
}

export async function publishPullRequestReview(
  review: CombinedReview,
): Promise<void> {
  const context = pullRequestContext();
  if (!context) return;

  const { comments, unmatched } = fileComments(review, context.changedPaths);
  const posted = await createReview(
    context,
    reviewBody(review, unmatched, "Findings outside the pull request diff:"),
    comments,
  );
  if (!posted.ok && comments.length > 0 && posted.status === 422) {
    console.error(
      `File comments were rejected (${posted.status}). Publishing the summary instead.`,
    );
    const fallback = await createReview(
      context,
      reviewBody(review, review.aiFindings, "Findings:"),
      [],
    );
    if (!fallback.ok) {
      throw new Error(
        `Failed to publish pull request review: ${fallback.status} ${fallback.message}`,
      );
    }
    console.log(
      `Published a pull request review on ${context.repository}#${context.pullNumber}.`,
    );
    return;
  }
  if (!posted.ok) {
    throw new Error(
      `Failed to publish pull request review: ${posted.status} ${posted.message}`,
    );
  }
  console.log(
    `Published a pull request review on ${context.repository}#${context.pullNumber} with ${comments.length} file comment(s).`,
  );
}
