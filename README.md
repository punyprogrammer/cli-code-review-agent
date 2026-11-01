# repo-review (starter)

CLI code review agent built on Vercel Sandbox. The project for the [Vercel Sandbox course on Vercel Academy](https://vercel.com/academy/vercel-sandbox).

This folder is the scaffold. Dependencies and tooling are set up, and `src/` is empty. You build the CLI lesson by lesson. The finished version lives next door in [`../complete`](../complete) if you get stuck or want to compare.

## Setup

Requires Node.js 22.12 or later.

```bash
pnpm install
vercel link
vercel env pull .env
```

`vercel env pull` writes a development OIDC token that authenticates both Sandbox and AI Gateway.

## Run from another repository

Other repositories call the reusable workflow in this repo. Every value to set, locally and in Actions, is listed in [docs/credentials.md](docs/credentials.md).

On a pull request, the workflow reviews that pull request's commit. The sandbox clones the caller, including a private caller, with the workflow's `GITHUB_TOKEN`.

```yaml
name: Code review
on:
  pull_request:

permissions:
  contents: read

jobs:
  review:
    uses: punyprogrammer/cli-code-review-agent/.github/workflows/review.yml@main
    secrets:
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      VERCEL_TEAM_ID: ${{ secrets.VERCEL_TEAM_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
      AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY }}
```

This file has to be on `main` before another repository can call it.

Then head to **Section 1: Sandbox Foundations, Your First Sandbox** in the course and start building.

## What you'll build

A CLI named `repo-review` that takes a GitHub URL, clones the repo into an isolated Vercel Sandbox, runs the test suite, generates a structured AI review with `openai/gpt-5.3-codex`, and prints a severity-sorted combined report.

By the end of the course, `src/` will contain:

- `sandbox-lifecycle.ts`: Sandbox creation, clone, file collection, test run
- `cli.ts`: `commander` setup, URL validation, pipeline orchestration
- `analyze.ts`: Zod-backed structured AI review with `generateText` and `Output.object`
- `test-runner.ts`: failure parser and package-manager detection
- `reporter.ts`: severity-sorted, CI-aware output

## Tech stack

- [`@vercel/sandbox`](https://vercel.com/docs/sandbox)
- [AI SDK 7](https://ai-sdk.dev/) with AI Gateway (`openai/gpt-5.3-codex`)
- [`commander`](https://github.com/tj/commander.js)
- [`zod`](https://zod.dev/)
- TypeScript 5, `tsx`, `pnpm`
