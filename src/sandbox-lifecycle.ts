import { Sandbox } from "@vercel/sandbox";
import { cwd } from "process";
import { detectPackageManager, ensureYarn } from "./test-runner";
export type TestResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};
export type LifecycleResult = {
  sandboxName: string;
  usedSnapshot: boolean;
  cloneExitCode: number;
  files: Array<{ path: string; content: string }>;
  testResult: TestResult;
};

const INTERESTING_PATHS = [
  "repo/package.json",
  "repo/src/index.ts",
  "repo/src/app.ts",
  "repo/lib/auth.ts",
];
const SNAPSHOT_ID = process.env.SANDBOX_SNAPSHOT_ID;

function sandboxAuth():
  | { token: string; teamId: string; projectId: string }
  | Record<string, never> {
  const token = process.env.VERCEL_TOKEN?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const supplied = [token, teamId, projectId].filter(Boolean);
  if (supplied.length === 0) return {};
  if (!token || !teamId || !projectId) {
    throw new Error(
      "VERCEL_TOKEN, VERCEL_TEAM_ID, and VERCEL_PROJECT_ID must all be set for CI auth.",
    );
  }
  return { token, teamId, projectId };
}

function githubCloneToken(): string | undefined {
  if (process.env.CI !== "true") return undefined;
  return (
    process.env.REVIEW_GITHUB_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim() ||
    undefined
  );
}

function redact(text: string): string {
  const secrets = [
    process.env.REVIEW_GITHUB_TOKEN,
    process.env.GITHUB_TOKEN,
    process.env.VERCEL_TOKEN,
    process.env.VERCEL_OIDC_TOKEN,
    process.env.AI_GATEWAY_API_KEY,
  ].filter((value): value is string => Boolean(value));
  return secrets.reduce(
    (message, secret) => message.split(secret).join("[redacted]"),
    text,
  );
}

async function requireZeroExit(
  result: { exitCode: number; stderr: () => Promise<string> },
  label: string,
): Promise<void> {
  if (result.exitCode === 0) return;
  throw new Error(`${label}: ${redact(await result.stderr())}`);
}

async function gitAuthEnv(
  sandbox: Sandbox,
): Promise<Record<string, string> | undefined> {
  const token = githubCloneToken();
  if (!token) return undefined;
  await sandbox.writeFiles([
    {
      path: "git-askpass",
      mode: 0o755,
      content: `#!/bin/sh
case "$1" in
  *[Uu]sername*) printf '%s\\n' "x-access-token" ;;
  *) printf '%s\\n' "$GIT_REVIEW_TOKEN" ;;
esac
`,
    },
  ]);
  const pwd = await sandbox.runCommand("pwd");
  await requireZeroExit(pwd, "Failed to locate the sandbox workdir");
  const root = (await pwd.stdout()).trim();
  return {
    GIT_ASKPASS: `${root}/git-askpass`,
    GIT_REVIEW_TOKEN: token,
    GIT_TERMINAL_PROMPT: "0",
  };
}

// create  a sandbox
async function createSandbox(): Promise<{
  sandbox: Sandbox;
  usedSnapshot: boolean;
}> {
  const auth = sandboxAuth();
  if (!SNAPSHOT_ID) {
    console.warn("SANDBOX_SNAPSHOT_ID is not set; using a default Sandbox.");
    const sandbox = await Sandbox.create({
      name: `repo-review-${Date.now()}`,
      persistent: false,
      timeout: 10 * 60 * 1000,
      ...auth,
    });
    const snapshot = await sandbox.snapshot();
    console.log(`Snapshot created: ${snapshot.snapshotId}`);
    return { sandbox, usedSnapshot: false };
  }
  const sandbox = await Sandbox.create({
    name: `repo-review-${Date.now()}`,
    source: { type: "snapshot", snapshotId: SNAPSHOT_ID },
    persistent: false,
    timeout: 10 * 60 * 1000,
    ...auth,
  });
  return { sandbox, usedSnapshot: true };
}
export async function runSandboxLifecycle(
  repoUrl: string,
): Promise<LifecycleResult> {
  const { sandbox, usedSnapshot } = await createSandbox();
  try {
    const gitEnv = await gitAuthEnv(sandbox);
    const clone = await sandbox.runCommand({
      cmd: "git",
      args: ["clone", "--depth=1", repoUrl, "repo"],
      env: gitEnv,
    });
    await requireZeroExit(clone, "Failed to clone repository");
    const revision = process.env.REVIEW_REVISION?.trim();
    if (revision) {
      const fetch = await sandbox.runCommand({
        cmd: "git",
        args: ["-C", "repo", "fetch", "--depth=1", "origin", revision],
        env: gitEnv,
      });
      await requireZeroExit(fetch, `Failed to fetch ${revision}`);
      const checkout = await sandbox.runCommand("git", [
        "-C",
        "repo",
        "checkout",
        "--detach",
        "FETCH_HEAD",
      ]);
      await requireZeroExit(checkout, `Failed to check out ${revision}`);
    }
    const files: Array<{ path: string; content: string }> = [];
    for (const fullPath of INTERESTING_PATHS) {
      const content = await sandbox.readFileToBuffer({ path: fullPath });
      if (content) {
        files.push({
          path: fullPath.replace(/^repo\//, ""),
          content: content.toString("utf8"),
        });
      }
    }
    for (const fullPath of INTERESTING_PATHS) {
      const content = await sandbox.readFileToBuffer({ path: fullPath });
      if (content) {
        files.push({
          path: fullPath.replace(/^repo\//, ""),
          content: content.toString("utf8"),
        });
      }
    }
    const packageManager = await detectPackageManager(sandbox, "repo");
    if (packageManager.name === "yarn") {
      await ensureYarn(sandbox, "repo");
    }
    // install dependencies
    const install = await sandbox.runCommand(packageManager.install);
    await requireZeroExit(install, "Failed to install dependencies");
    // run the test
    const test = await sandbox.runCommand(packageManager.test);
    await requireZeroExit(test, "Failed to test");
    return {
      sandboxName: sandbox.name,
      usedSnapshot,
      cloneExitCode: clone.exitCode,
      files,
      testResult: {
        exitCode: test.exitCode,
        stderr: await test.stderr(),
        stdout: await test.stdout(),
      },
    };
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    await sandbox.stop();
  }
}
