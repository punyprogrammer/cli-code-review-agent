import { Command } from "commander";
import { isValidGitHubRepoUrl } from "../utils/utilFunctions";
import { runSandboxLifecycle } from "./sandbox-lifecycle";
const program = new Command();

program
  .name("repo-review")
  .description("Clone and review a Github repository in a Sandbox")
  .version("0.1.0");
program
  .command("review <repoUrl>")
  .description("Run a Sandbox review against a Github Repository URL")
  .action(async (repoUrl: string) => {
    if (!isValidGitHubRepoUrl(repoUrl)) {
      console.log("Invalid GitHub repository URL");
      process.exit(1);
    }

    console.log(`Would review repo: ${repoUrl}`);
    const result = await runSandboxLifecycle(repoUrl);
    console.log(`Sandbox: ${result.sandboxName}`);
    console.log(`Clone exit code: ${result.cloneExitCode}`);
    console.log(`Files:\n${result.files}`);
    console.log(`README preview:\n${result.readmePreview}`);
  });
// Parse the arguments and run the command
await program.parseAsync(process.argv);
