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
// create  a sandbox
async function createSandbox(): Promise<{
  sandbox: Sandbox;
  usedSnapshot: boolean;
}> {
  if (!SNAPSHOT_ID) {
    console.warn("SANDBOX_SNAPSHOT_ID is not set; using a default Sandbox.");
    const sandbox = await Sandbox.create({
      name: `repo-review-${Date.now()}`,
      persistent: false,
      timeout: 10 * 60 * 1000,
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
  });
  return { sandbox, usedSnapshot: true };
}
export async function runSandboxLifecycle(
  repoUrl: string,
): Promise<LifecycleResult> {
  const { sandbox, usedSnapshot } = await createSandbox();
  try {
    const clone = await sandbox.runCommand("git", [
      "clone",
      "--depth=1",
      repoUrl,
      "repo",
    ]);
    if (clone.exitCode !== 0) {
      throw new Error(`Failed to clone repository: ${clone.stderr()}`);
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
    if (install.exitCode !== 0) {
      throw new Error(`Failed to install dependencies: ${install.stderr()}`);
    }
    // run the test
    const test = await sandbox.runCommand(packageManager.test);
    if (test.exitCode !== 0) {
      throw new Error(`Failed to test: ${test.stderr()}`);
    }
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
