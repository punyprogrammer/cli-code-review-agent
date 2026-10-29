import { Sandbox } from "@vercel/sandbox";
import { read } from "fs";
const REPO_URL = "https://github.com/vercel/examples";
async function main() {
  const sandbox = await Sandbox.create({
    name: `repo-review-${Date.now()}`,
    persistent: false,
    timeout: 10 * 60 * 1000,
  });
  console.log(`Sandbox created: ${sandbox.name}`);
  //   Does a git clone with depth 1 to avoid downloading the entire history
  //   This is important because the sandbox is limited in size and we don't need the entire history
  //   The repo is cloned into the sandbox's filesystem at /repo
  const clone = await sandbox.runCommand("git", [
    "clone",
    "--depth=1",
    REPO_URL,
    "repo",
  ]);
  if (clone.exitCode !== 0) {
    console.error(`Failed to clone repository: ${clone.stderr()}`);
    process.exit(1);
    await sandbox.stop();
    return;
  }
  //   This lists the contents of the cloned repository
  const ls = await sandbox.runCommand("ls", ["-la", "repo"]);
  console.log("Repo contents");
  console.log(await ls.stdout());
  let readmePreview = "(no README.md found)";
  //   Read the readme
  const readme = await sandbox.readFileToBuffer({ path: "repo/README.md" });
  if (readme) {
    readmePreview = readme.toString("utf-8").substring(0, 100);
  }
  console.log("--- README preview ---");
  console.log(readmePreview);
  await sandbox.stop();
  console.log("Sandbox stopped.");
}
main();
