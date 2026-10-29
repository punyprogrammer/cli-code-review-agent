import { Sandbox } from "@vercel/sandbox";

export type TestFinding = {
  severity: "medium" | "high";
  category: "test-failure";
  summary: string;
  details: string;
};
export type PackageManagerCommands = {
  name: "pnpm" | "npm" | "yarn";
  install: { cmd: string; args: string[]; cwd: string };
  test: { cmd: string; args: string[]; cwd: string };
};

export async function detectPackageManager(
  sandbox: Sandbox,
  repoDir = "repo",
): Promise<PackageManagerCommands> {
  const checks: Array<{ file: string; commands: PackageManagerCommands }> = [
    {
      file: "pnpm-lock.yaml",
      commands: {
        name: "pnpm",
        install: { cmd: "pnpm", args: ["install"], cwd: repoDir },
        test: { cmd: "pnpm", args: ["test"], cwd: repoDir },
      },
    },
    {
      file: "yarn.lock",
      commands: {
        name: "yarn",
        install: { cmd: "yarn", args: ["install"], cwd: repoDir },
        test: { cmd: "yarn", args: ["test"], cwd: repoDir },
      },
    },
    {
      file: "package-lock.json",
      commands: {
        name: "npm",
        install: { cmd: "npm", args: ["install"], cwd: repoDir },
        test: { cmd: "npm", args: ["test"], cwd: repoDir },
      },
    },
  ];

  for (const { file, commands } of checks) {
    if (await sandbox.fs.exists(`${repoDir}/${file}`)) {
      return commands;
    }
  }

  // No lockfile at all: default to npm install as the last-resort fallback
  return {
    name: "npm",
    install: { cmd: "npm", args: ["install"], cwd: repoDir },
    test: { cmd: "npm", args: ["test"], cwd: repoDir },
  };
}

const DEFAULT_YARN_SPEC = "yarn@1.22.22";

export async function ensureYarn(
  sandbox: Sandbox,
  repoDir = "repo",
): Promise<void> {
  const spec = await yarnPackageManagerSpec(sandbox, repoDir);
  const enable = await sandbox.runCommand({
    cmd: "corepack",
    args: ["enable"],
    sudo: true,
  });
  if (enable.exitCode !== 0) {
    throw new Error(`Failed to enable Corepack: ${await enable.stderr()}`);
  }
  const prepare = await sandbox.runCommand("corepack", [
    "prepare",
    spec,
    "--activate",
  ]);
  if (prepare.exitCode !== 0) {
    throw new Error(`Failed to install Yarn: ${await prepare.stderr()}`);
  }
}

async function yarnPackageManagerSpec(
  sandbox: Sandbox,
  repoDir: string,
): Promise<string> {
  const content = await sandbox.readFileToBuffer({
    path: `${repoDir}/package.json`,
  });
  if (!content) return DEFAULT_YARN_SPEC;
  try {
    const pkg = JSON.parse(content.toString("utf8")) as {
      packageManager?: string;
    };
    if (pkg.packageManager?.startsWith("yarn@")) return pkg.packageManager;
  } catch {
    return DEFAULT_YARN_SPEC;
  }
  return DEFAULT_YARN_SPEC;
}

const FAILURE_MARKERS = ["FAIL ", "✕ ", "× "];

export function parseTestFailures(output: string): TestFinding[] {
  const lines = output.split("\n");

  return lines
    .map((line) => line.trim())
    .filter((line) => FAILURE_MARKERS.some((marker) => line.startsWith(marker)))
    .map((line) => ({
      severity: "high" as const,
      category: "test-failure" as const,
      summary: "Automated test failure",
      details: line,
    }));
}
