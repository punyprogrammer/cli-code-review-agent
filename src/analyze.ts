import { generateText, Output } from "ai";
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
export async function analyzeRepository(
  files: Array<{ path: string; content: string }>,
): Promise<Review> {
  const result = await generateText({
    model: "openai/gpt-5.3-codex",
    instructions: [
      "You are a senior application security and code quality reviewer.",
      "Return only findings that are directly supported by the provided source.",
      "Prefer precise, actionable recommendations over generic advice.",
      "If there are no findings, return an empty findings array.",
    ].join("\n"),
    output: Output.object({ schema: reviewSchema }),
    prompt: files.map((f) => `FILE: ${f.path}\n${f.content}`).join("\n"),
  });

  return result.output;
}
