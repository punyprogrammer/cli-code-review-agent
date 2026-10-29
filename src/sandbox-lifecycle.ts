import { Sandbox } from "@vercel/sandbox";
export type LifecycleResult = {
  sandboxName: string;
  cloneExitCode: number;
  files: string;
  readmePreview: string;
};

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
    const ls = await sandbox.runCommand("ls", ["-la", "repo"]);
    const readme = await sandbox.readFileToBuffer({ path: "repo/README.md" });
    return {
      sandboxName: sandbox.name,
      cloneExitCode: clone.exitCode,
      files: await ls.stdout(),
      readmePreview: readme
        ? readme.toString("utf-8").substring(0, 300)
        : "(no README.md found)",
    };
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    await sandbox.stop();
  }
}
const REPO_URL = "https://github.com/vercel/examples";


