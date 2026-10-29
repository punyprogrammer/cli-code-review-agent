import { generateText } from "ai";
import z from "zod";

export const findingSchema = z.object({
  severity: z.enum(["low", "medium", "high", "critical"]),
  category: z.enum(["security", "quality", "performance", "reliability"]),
  file: z.string(),
  summary: z.string(),
  recommendation: z.string(),
});
export const reviewSchema = z.object({
  overallRisk: z.enum(["low", "medium", "high"]),
  findings: z.array(findingSchema),
});
export type Finding = z.infer<typeof findingSchema>;
export type Review = z.infer<typeof reviewSchema>;
export async function analyzeWithPromptV1(source: string): Promise<string> {
  const result = await generateText({
    model: "openai/gpt-5.3-codex",
    prompt: `Review this code and tell what is wrong: \n\n${source}`,
  });
  return result.text;
}
const sample: Review = {
  overallRisk: "medium",
  findings: [
    {
      severity: "high",
      category: "security",
      file: "src/auth.ts",
      summary: "Hardcoded password",
      recommendation: "Use bcrypt and an env var",
    },
  ],
};

console.log(reviewSchema.parse(sample));
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
