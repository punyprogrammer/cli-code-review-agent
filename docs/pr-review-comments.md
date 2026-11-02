# Review comments on a new pull request

Run the review once, the first time a pull request is opened, then post the findings on that pull request.

`printReview` in `src/cli.ts` writes the findings to the Action log. The pull request does not receive a GitHub review. `.github/workflows/review.yml` already uses the pull request number to list changed files and passes that list to the sandbox as `REVIEW_PATHS`. The changes below are what is still required to publish those findings as review comments.

## Credentials

Add these in the caller repository under **Settings → Secrets and variables → Actions**. Full notes are in [credentials.md](credentials.md).

| Secret | Required | Where the value comes from |
|---|---|---|
| `VERCEL_TOKEN` | Yes | Account token from [vercel.com/account/tokens](https://vercel.com/account/tokens). Authenticates the sandbox. |
| `VERCEL_TEAM_ID` | Yes | `orgId` in `.vercel/project.json` after `vercel link` in this reviewer repo. |
| `VERCEL_PROJECT_ID` | Yes | `projectId` in `.vercel/project.json`. |
| `AI_GATEWAY_API_KEY` | Yes | AI Gateway key from the Vercel dashboard. Used for `openai/gpt-5.3-codex`. |
| `SANDBOX_SNAPSHOT_ID` | No | Snapshot id from a `Snapshot created:` log line. |

Pass the required four from the caller. Omit `SANDBOX_SNAPSHOT_ID` when you have no snapshot.

```yaml
secrets:
  VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
  VERCEL_TEAM_ID: ${{ secrets.VERCEL_TEAM_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
  AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY }}
```

The review comment uses `github.token`. That token is already passed into the review step as `GH_TOKEN` and `REVIEW_GITHUB_TOKEN`. It is not a secret you create.

| Token permission | Required on | Purpose |
|---|---|---|
| `contents: read` | Caller workflow and `review.yml` | Clone the pull request and list its files. Already set in `review.yml`. |
| `pull-requests: write` | Caller workflow and `review.yml` | Create the pull request review. Missing from `review.yml` today, so the job token cannot comment. |

`review.yml` sets `permissions: contents: read` for the whole job. Add `pull-requests: write` there and in the caller. A permission left off that block is denied.

## 1. Trigger only when the pull request is opened

In the caller repository, limit the workflow to `opened`. A later push is `synchronize` and does not start another review.

```yaml
name: Code review
on:
  pull_request:
    types: [opened]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    uses: punyprogrammer/cli-code-review-agent/.github/workflows/review.yml@main
    secrets:
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      VERCEL_TEAM_ID: ${{ secrets.VERCEL_TEAM_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
      AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY }}
```

This workflow file has to be on `main` of `cli-code-review-agent` before another repository can call it.

## 2. Hand the pull request number and head commit to the CLI

On `pull_request`, GitHub provides:

| Value | Expression | Already available in `review.yml` |
|---|---|---|
| Pull request number | `github.event.pull_request.number` | Yes, as `PR_NUMBER`. Used only to list changed files. |
| Head commit | `github.event.pull_request.head.sha` | Yes, as `PR_SHA`, then `REVIEW_REVISION`. |
| Repository | `github.repository` | Yes, as `CALLER_REPO`. |
| Changed files | pulls files API | Yes, written to `REVIEW_PATHS`. Deleted files are skipped. |

`src/cli.ts` never reads `PR_NUMBER`. Export `PR_NUMBER` and `REVIEW_REVISION` into the `pnpm exec tsx` process, and add `pull-requests: write` to `review.yml`.

A local `pnpm review <url>` has no pull request number. It still reads `package.json`, `src/index.ts`, `src/app.ts`, and `lib/auth.ts`.

## 3. Give each finding a line

`findingSchema` in `src/analyze.ts` returns `file`, `severity`, `category`, `summary`, and `recommendation`. Add `line` and ask the model for the line in that file.

Test findings from `src/test-runner.ts` have no file or line. They belong in the review body.

## 4. Publish one pull request review

After `printReview` in `src/cli.ts`, when `PR_NUMBER` is set, create one review with `gh api` and `GH_TOKEN`:

`POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews`

```json
{
  "commit_id": "<REVIEW_REVISION>",
  "event": "COMMENT",
  "body": "Overall risk and any test findings",
  "comments": [
    {
      "path": "src/app.ts",
      "line": 12,
      "side": "RIGHT",
      "body": "[HIGH] summary\n\nrecommendation"
    }
  ]
}
```

`event: COMMENT` leaves a review and does not approve or request changes.

GitHub accepts an inline comment when that line is part of the pull request diff. Put a finding on `side: RIGHT` at `line` when the diff contains that line. Put every other finding, including test findings, in the review `body`.

## 5. Check the first open

Open a new pull request in a caller repository. One Action run should start, and the log should list every changed file. The pull request should show one review summary plus inline comments on changed lines. Push another commit to that same pull request and confirm a second review does not start.
