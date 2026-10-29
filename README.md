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
