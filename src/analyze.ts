import { generateText } from "ai";

export async function analyzeWithPromptV1(source: string): Promise<string> {
  const result = await generateText({
    model: "openai/gpt-5.3-codex",
    prompt: `Review this code and tell what is wrong: \n\n${source}`,
  });
  return result.text;
}
async function main() {
  const source = `
      export function login(user: string, password: string) {
        if (password === 'admin') return true;
        return false;
      }
    `;

  const review = await analyzeWithPromptV1(source);
  console.log(review);
}

main();
