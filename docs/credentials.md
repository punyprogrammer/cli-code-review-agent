# Credentials

Set these values yourself. This file lists names and where each value comes from. It does not contain secrets.

`pnpm review` loads `.env` in this repository. GitHub Actions on other repositories read Actions secrets. The workflow passes those secrets into the CLI.

## Local (`.env`)

Run `vercel link`, then `vercel env pull .env`. That writes `VERCEL_OIDC_TOKEN`.

| Name | Required | Purpose |
|---|---|---|
| `VERCEL_OIDC_TOKEN` | Yes, for local runs | Authenticates Vercel Sandbox and AI Gateway. Expires after about 12 hours. Run `vercel env pull .env` again when reviews start failing auth. |
| `AI_GATEWAY_API_KEY` | No | AI Gateway key. When set, model calls use this key. Create it in the Vercel dashboard under AI Gateway. |
| `SANDBOX_SNAPSHOT_ID` | No | Snapshot id from a previous `Snapshot created:` log line, for example `snap_...`. |
| `VERCEL_TOKEN` | No | Account token from [vercel.com/account/tokens](https://vercel.com/account/tokens). Used only when `VERCEL_TEAM_ID` and `VERCEL_PROJECT_ID` are set too. |
| `VERCEL_TEAM_ID` | No | Team id. Same value as `orgId` in `.vercel/project.json` after `vercel link`. |
| `VERCEL_PROJECT_ID` | No | Project id. Same value as `projectId` in `.vercel/project.json`. |

Local auth uses `VERCEL_OIDC_TOKEN`. Set `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID` together only when you want the same auth path as GitHub Actions. If any one of those three is missing, the CLI refuses to start.

```bash
VERCEL_OIDC_TOKEN=
# AI_GATEWAY_API_KEY=
# SANDBOX_SNAPSHOT_ID=
# VERCEL_TOKEN=
# VERCEL_TEAM_ID=
# VERCEL_PROJECT_ID=
```

## GitHub Actions (each repository that calls the review)

In the caller repository, open **Settings → Secrets and variables → Actions** and add these secrets.

| Secret | Required | Purpose |
|---|---|---|
| `VERCEL_TOKEN` | Yes | Account token from [vercel.com/account/tokens](https://vercel.com/account/tokens). Sandbox auth in Actions. |
| `VERCEL_TEAM_ID` | Yes | `orgId` from `.vercel/project.json` in this reviewer repo. |
| `VERCEL_PROJECT_ID` | Yes | `projectId` from `.vercel/project.json` in this reviewer repo. |
| `AI_GATEWAY_API_KEY` | Yes | AI Gateway key for `openai/gpt-5.3-codex`. |
| `SANDBOX_SNAPSHOT_ID` | No | Same snapshot id as local, when you want Actions to restore that snapshot. |

Pass them from the caller workflow:

```yaml
secrets:
  VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
  VERCEL_TEAM_ID: ${{ secrets.VERCEL_TEAM_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
  AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY }}
  SANDBOX_SNAPSHOT_ID: ${{ secrets.SANDBOX_SNAPSHOT_ID }}
```

`SANDBOX_SNAPSHOT_ID` can be omitted. The workflow already declares it as optional.

## Set by the workflow

These are not secrets you create.

| Name | Source | Purpose |
|---|---|---|
| `REVIEW_GITHUB_TOKEN` | `github.token` in `.github/workflows/review.yml` | Lets the sandbox clone the caller, including a private caller. The caller workflow needs `permissions: contents: read`. |
| `REVIEW_REVISION` | Pull request head SHA, or the `revision` input | Commit, branch, or tag the sandbox checks out after clone. |
| `CI` | `"true"` in the review step | Turns on clone auth and plain log output. |
