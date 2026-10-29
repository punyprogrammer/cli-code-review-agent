import { Sandbox } from "@vercel/sandbox";
async function main() {
  const sandbox = await Sandbox.create({
    name: `repo-review-${Date.now()}`,
    persistent: false,
    timeout: 10 * 60 * 1000,
  });
  console.log(`Sandbox created: ${sandbox.name}`);
  const result = await sandbox.runCommand("echo", [
    "hello from inside the sandbox",
  ]);
  console.log(`Output: ${(await result.stdout()).trim()}`);
  console.log(`Exit code: ${result.exitCode}`);

  await sandbox.stop();
  console.log("Sandbox stopped.");
}
main();
