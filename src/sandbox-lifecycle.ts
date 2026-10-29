import { Sandbox } from "@vercel/sandbox";
export type LifecycleResult = {
  sandboxName: string;
  cloneExitCode: number;
  files: Array<{ path: string; content: string }>;
};
const INTERESTING_PATHS = [
  "repo/package.json",
  "repo/src/index.ts",
  "repo/src/app.ts",
  "repo/lib/auth.ts",
];

export async function runSandboxLifecycle(
  repoUrl: string,
): Promise<LifecycleResult> {
  const sandbox = await Sandbox.create({
    name: `repo-review-${Date.now()}`,
    persistent: false,
    timeout: 10 * 60 * 1000,
  });
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
    return {
      sandboxName: sandbox.name,
      cloneExitCode: clone.exitCode,
      files,
    };
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    await sandbox.stop();
  }
}

