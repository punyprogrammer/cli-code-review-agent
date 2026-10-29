import { Command } from "commander";

const program = new Command();

program
  .name("repo-review")
  .description("Clone and review a Github repository in a Sandbox")
  .version("0.1.0");
program
  .command("review <repoUrl>")
  .description("Run a Sandbox review against a Github Repository URL")
  .action(async (repoUrl: string) => {
    console.log(`Would review repo: ${repoUrl}`);
  });
// Parse the arguments and run the command
await program.parseAsync(process.argv);
